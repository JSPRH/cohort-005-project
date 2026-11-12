// PROTOTYPE, throwaway. Answers: "What does Nudge copy sound like in our Duolingo tone?" (issue #5).
// Three voices for every Nudge kind, web push + email, switchable via ?variant=A|B|C.
// Copy is templated: {name} {course} {nextLesson} {lessonsLeft} {quiz} {quizLesson} {score} {passMark}.
// Lives on the prototype/nudge-copy branch only. Never merge to main.
import { useState } from "react";
import { useSearchParams } from "react-router";
import { asc, eq } from "drizzle-orm";
import type { Route } from "./+types/prototype.nudge-copy";
import { db } from "~/db";
import {
  courses,
  CourseStatus,
  lessons,
  modules,
  quizzes,
  users,
} from "~/db/schema";
import { getCurrentUserId } from "~/lib/session";
import { PrototypeSwitcher } from "~/components/prototype-switcher";

// ─── Data: real course/lesson/quiz names so the copy is judged against real lengths ───

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getCurrentUserId(request);
  const user = userId
    ? db.select().from(users).where(eq(users.id, userId)).get()
    : undefined;

  const published = db
    .select()
    .from(courses)
    .where(eq(courses.status, CourseStatus.Published))
    .all();

  const samples = published.map((course) => {
    const courseLessons = db
      .select({ id: lessons.id, title: lessons.title })
      .from(lessons)
      .innerJoin(modules, eq(lessons.moduleId, modules.id))
      .where(eq(modules.courseId, course.id))
      .orderBy(asc(modules.position), asc(lessons.position))
      .all();
    const quiz = db
      .select({ title: quizzes.title, lessonTitle: lessons.title })
      .from(quizzes)
      .innerJoin(lessons, eq(quizzes.lessonId, lessons.id))
      .innerJoin(modules, eq(lessons.moduleId, modules.id))
      .where(eq(modules.courseId, course.id))
      .get();
    return {
      course: course.title,
      firstLesson: courseLessons[0]?.title ?? "Welcome",
      midLesson:
        courseLessons[Math.floor(courseLessons.length / 2)]?.title ??
        "Lesson 3",
      lastLessons: courseLessons.at(-2)?.title ?? "Wrapping up",
      quiz: quiz?.title ?? "Module 1 quiz",
      quizLesson: quiz?.lessonTitle ?? "Lesson 2",
    };
  });

  return {
    firstName: user?.name.split(" ")[0] ?? "Sam",
    samples: samples.length
      ? samples
      : [
          {
            course: "Intro to TypeScript",
            firstLesson: "Why types?",
            midLesson: "Generics",
            lastLessons: "Putting it together",
            quiz: "Generics quiz",
            quizLesson: "Generics",
          },
        ],
  };
}

// ─── Copy ───

type Kind = "neverStarted" | "goneQuiet" | "almostThere" | "failedQuiz";
type Push = { title: string; body: string };
type Email = { greeting: string; paras: string[]; cta: string };
type Voice = {
  key: string;
  name: string;
  rules: string[];
  // Repeating kinds: one array of push variants per Ignored Nudges in a row (0, 1, 2).
  // One-shot kinds: a single array.
  push: {
    neverStarted: Push[][];
    goneQuiet: Push[][];
    almostThere: Push[];
    failedQuiz: Push[];
  };
  email: Record<Kind, Email>;
  lastLine: string; // appended to the email when this is the 3rd Nudge in a row (the one before we give up)
};

const VOICES: Voice[] = [
  {
    key: "A",
    name: "Coach",
    rules: [
      "Warm and encouraging, like a good tutor",
      "No emoji",
      "Never guilt: later Nudges get softer and shorter",
      "3rd Nudge says plainly that we'll stop",
    ],
    push: {
      neverStarted: [
        [
          { title: "Ready when you are, {name}", body: "{course} is waiting. Your first lesson, {nextLesson}, takes a few minutes." },
          { title: "Your first lesson is ready", body: "Start {course} with {nextLesson}. Ten minutes is plenty for today." },
        ],
        [
          { title: "Still keen on {course}?", body: "Starting is the hardest part. {nextLesson} is a gentle way in." },
          { title: "A small start counts", body: "Just press play on {nextLesson}. That's the whole task for today." },
        ],
        [
          { title: "One last nudge for {course}", body: "We'll stop reminding you after this. {course} stays here whenever you're ready." },
          { title: "No pressure, {name}", body: "This is our last reminder about {course}. Your place isn't going anywhere." },
        ],
      ],
      goneQuiet: [
        [
          { title: "Pick up where you left off", body: "Next up in {course}: {nextLesson}." },
          { title: "Back to {course}?", body: "You're part-way through. Next up: {nextLesson}." },
        ],
        [
          { title: "Your progress is saved", body: "Everything's where you left it in {course}. Next: {nextLesson}." },
          { title: "A few minutes today?", body: "One lesson keeps {course} fresh in your head. Next: {nextLesson}." },
        ],
        [
          { title: "We'll go quiet after this", body: "Last reminder about {course}. Come back whenever suits you; your progress is saved." },
        ],
      ],
      almostThere: [
        { title: "Only {lessonsLeft} to go", body: "You're close to finishing {course}. Next: {nextLesson}." },
        { title: "The finish line is in sight", body: "{lessonsLeft} left in {course}. You could wrap it up this week." },
      ],
      failedQuiz: [
        { title: "Have another go at {quiz}", body: "You scored {score}%; {passMark}% passes. Rewatch {quizLesson}, then try again." },
        { title: "So close on {quiz}", body: "Quizzes are for learning. Have another go when you're ready." },
      ],
    },
    email: {
      neverStarted: { greeting: "Hi {name},", paras: ["You're enrolled on {course}, and your first lesson is ready: {nextLesson}.", "The first lesson is usually the hardest one to start. After that, it's just the next one."], cta: "Start {nextLesson}" },
      goneQuiet: { greeting: "Hi {name},", paras: ["Your progress in {course} is saved. Next up is {nextLesson}.", "Even one lesson today keeps it fresh."], cta: "Continue {course}" },
      almostThere: { greeting: "Hi {name},", paras: ["You have {lessonsLeft} left in {course}. Next up is {nextLesson}.", "Finishing is closer than it looks."], cta: "Keep going" },
      failedQuiz: { greeting: "Hi {name},", paras: ["You scored {score}% on {quiz}; {passMark}% passes.", "Rewatching {quizLesson} is usually enough. Then try again whenever you're ready."], cta: "Retry {quiz}" },
    },
    lastLine: "This is our last reminder about {course}. Your progress stays saved.",
  },
  {
    key: "B",
    name: "Cheeky",
    rules: [
      "Playful and wry, self-aware about being a reminder",
      "At most one emoji, in the title",
      "Mock-drama grows on repeats, but the joke is on us, never on the Student",
      "3rd Nudge exits gracefully with a joke",
    ],
    push: {
      neverStarted: [
        [
          { title: "{course} is still in the wrapper 🎁", body: "Your first lesson, {nextLesson}, is right there. Go on, peek." },
          { title: "Psst, {name}", body: "You've got {course}. It would love to meet you. {nextLesson} is a quick hello." },
        ],
        [
          { title: "Okay, we'll ask nicely again 🙏", body: "{nextLesson} is still unwatched. It's starting to take it personally." },
          { title: "The course is fine. Probably.", body: "{course} hasn't been opened yet. One lesson and we'll stop being weird about it." },
        ],
        [
          { title: "Last one, promise 🤐", body: "We'll stop nudging about {course} now. It'll be right here, looking hopeful." },
          { title: "This is us letting go", body: "No more Nudges for {course}. If you change your mind, {nextLesson} still says hi." },
        ],
      ],
      goneQuiet: [
        [
          { title: "{course} called 📞", body: "It wants to know if you're coming back for {nextLesson}." },
          { title: "Where'd you go, {name}?", body: "You left mid-course. {nextLesson} is next and it's a good one." },
        ],
        [
          { title: "Still thinking about you 👀", body: "{course}, that is. {nextLesson} is queued up and ready." },
          { title: "Your progress bar looks lonely", body: "It's been stuck for a bit. One lesson of {course} would cheer it right up." },
        ],
        [
          { title: "We'll take the hint 🫡", body: "Last Nudge about {course}. Your progress is saved. No hard feelings." },
        ],
      ],
      almostThere: [
        { title: "{lessonsLeft} left. LEFT. 🏁", body: "You're basically done with {course}. Finish it before the weekend?" },
        { title: "So close you can smell it", body: "{lessonsLeft} to go in {course}. Next up: {nextLesson}." },
      ],
      failedQuiz: [
        { title: "{quiz}: round two? 🥊", body: "{score}% last time, {passMark}% passes. Rewatch {quizLesson} and go again." },
        { title: "The quiz won this round", body: "But you get a rematch. {passMark}% passes {quiz}; you got {score}%." },
      ],
    },
    email: {
      neverStarted: { greeting: "Hey {name},", paras: ["{course} is sitting on your dashboard, still in the wrapper.", "{nextLesson} is a gentle start. Go on, unwrap it."], cta: "Unwrap it" },
      goneQuiet: { greeting: "Hey {name},", paras: ["{course} noticed you've been gone. It's not upset. It's just been staring at the door.", "Next up: {nextLesson}."], cta: "Pick it back up" },
      almostThere: { greeting: "{name}!", paras: ["{lessonsLeft} left in {course}. That's it. That's the email.", "Next up: {nextLesson}."], cta: "Finish the thing" },
      failedQuiz: { greeting: "Hey {name},", paras: ["{quiz} got the better of you this time: {score}%, and you need {passMark}%.", "Rewatch {quizLesson}, then come back and settle the score."], cta: "Rematch" },
    },
    lastLine: "We'll stop nudging about {course} now. No hard feelings; it'll be right here.",
  },
  {
    key: "C",
    name: "Full owl",
    rules: [
      "Loud, emoji-heavy, melodramatic",
      "Guilt escalates with each Ignored Nudge",
      "Some false urgency ('before it's too late')",
      "Shown as the far end of the scale: what 'too much' looks like",
    ],
    push: {
      neverStarted: [
        [
          { title: "👋 {name}! Your course is waiting!", body: "{course} is ready and so are we. Start {nextLesson} now! 🚀" },
        ],
        [
          { title: "😟 Did we do something wrong?", body: "{course} still hasn't been opened. {nextLesson} is getting sad." },
          { title: "😕 These reminders aren't working", body: "Maybe just one lesson? {nextLesson}. For us?" },
        ],
        [
          { title: "😢 This is goodbye, {name}", body: "We'll stop asking about {course}. We'll just sit here. Alone. Waiting." },
          { title: "💔 We give up. (Not really.)", body: "Last reminder for {course}. {nextLesson} will never forget you." },
        ],
      ],
      goneQuiet: [
        [
          { title: "🔥 Don't lose your momentum!", body: "{nextLesson} in {course} won't watch itself! 💪" },
        ],
        [
          { title: "😬 It's been a while...", body: "{course} is starting to forget what you look like. Come back to {nextLesson}!" },
          { title: "👀 We noticed.", body: "You haven't touched {course} in days. {nextLesson}. Now?" },
        ],
        [
          { title: "😭 Fine. We'll stop.", body: "This is our last message about {course}. We hope you're happy. (Come back.)" },
        ],
      ],
      almostThere: [
        { title: "🏁 {lessonsLeft} LEFT!!! 🎉", body: "You're SO close to finishing {course}. Don't stop now!" },
        { title: "😱 Don't quit at the finish line!", body: "Only {lessonsLeft} to go in {course}. Imagine stopping now. We can't." },
      ],
      failedQuiz: [
        { title: "😤 {quiz} beat you. Get revenge!", body: "{score}%? You can do better than that. {passMark}% to pass. Go!" },
        { title: "💪 Rematch time!", body: "{quiz} is waiting for round two. Rewatch {quizLesson} and crush it." },
      ],
    },
    email: {
      neverStarted: { greeting: "{name}! 👋", paras: ["You haven't started {course} yet! 😱", "{nextLesson} is waiting for you RIGHT NOW. What are you waiting for? 🚀"], cta: "START NOW 🚀" },
      goneQuiet: { greeting: "{name}... 😟", paras: ["It's been days since you studied {course}. Your lessons miss you. We miss you.", "Come back to {nextLesson} before it's too late!"], cta: "COME BACK 🙏" },
      almostThere: { greeting: "🎉 {name}!!! 🎉", paras: ["Only {lessonsLeft} left in {course}! You're SO close!", "Don't you dare stop now! 💪"], cta: "FINISH IT 🏁" },
      failedQuiz: { greeting: "{name}, 😤", paras: ["{quiz} beat you with {score}%. You need {passMark}%.", "Are you going to let a quiz win? Rewatch {quizLesson} and show it who's boss!"], cta: "GET REVENGE 💪" },
    },
    lastLine: "😢 This is our last email about {course}. We'll just be here. Waiting. Forever.",
  },
];

const KINDS: { kind: Kind; label: string; trigger: string; repeats: boolean }[] = [
  { kind: "neverStarted", label: "Never started", trigger: "2 days after Enrollment, no Study yet (day 2, 5, 11)", repeats: true },
  { kind: "goneQuiet", label: "Gone quiet", trigger: "4 days without Study (then +8, +16)", repeats: true },
  { kind: "almostThere", label: "Almost there", trigger: "≤2 lessons left, 1 day without Study. Once per Enrollment", repeats: false },
  { kind: "failedQuiz", label: "Failed quiz", trigger: "1 day after a failed attempt, no pass since. Once per quiz", repeats: false },
];

// Rough visible limits before truncation (Chrome on Android/macOS banners).
const TITLE_LIMIT = 50;
const BODY_LIMIT = 120;

// ─── Rendering ───

type Vars = Record<string, string>;

function fill(template: string, vars: Vars, raw: boolean) {
  if (raw) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

function Text({ t, vars, raw }: { t: string; vars: Vars; raw: boolean }) {
  if (!raw) return <>{fill(t, vars, false)}</>;
  return (
    <>
      {t.split(/(\{\w+\})/).map((part, i) =>
        part.startsWith("{") ? (
          <span key={i} className="rounded bg-amber-100 px-0.5 font-mono text-amber-800">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
}

function PushCard({ push, vars, raw }: { push: Push; vars: Vars; raw: boolean }) {
  const title = fill(push.title, vars, false);
  const body = fill(push.body, vars, false);
  return (
    <div className="w-80 rounded-2xl bg-white/90 p-3 shadow-lg ring-1 ring-black/10 backdrop-blur">
      <div className="mb-1 flex items-center gap-2 text-[11px] text-gray-500">
        <span className="grid size-4 place-items-center rounded bg-indigo-600 text-[9px] font-bold text-white">C</span>
        Cadence · now
      </div>
      <div className="text-sm font-semibold leading-snug">
        <Text t={push.title} vars={vars} raw={raw} />
      </div>
      <div className="text-sm leading-snug text-gray-700">
        <Text t={push.body} vars={vars} raw={raw} />
      </div>
      <div className="mt-1 flex gap-3 font-mono text-[10px]">
        <span className={title.length > TITLE_LIMIT ? "font-bold text-red-600" : "text-gray-400"}>
          title {title.length}/{TITLE_LIMIT}
        </span>
        <span className={body.length > BODY_LIMIT ? "font-bold text-red-600" : "text-gray-400"}>
          body {body.length}/{BODY_LIMIT}
        </span>
      </div>
    </div>
  );
}

function EmailCard({
  subject,
  preheader,
  email,
  last,
  lastLine,
  vars,
  raw,
}: {
  subject: string;
  preheader: string;
  email: Email;
  last: boolean;
  lastLine: string;
  vars: Vars;
  raw: boolean;
}) {
  return (
    <div className="w-[26rem] overflow-hidden rounded-lg bg-white shadow ring-1 ring-black/10">
      <div className="border-b bg-gray-50 px-4 py-2 text-xs text-gray-600">
        <div>
          <b>From:</b> Cadence &lt;nudges@cadence.example&gt;
        </div>
        <div>
          <b>Subject:</b> <Text t={subject} vars={vars} raw={raw} />
        </div>
        <div className="truncate text-gray-400">
          <b>Preview:</b> <Text t={preheader} vars={vars} raw={raw} />
        </div>
      </div>
      <div className="space-y-3 px-4 py-4 text-sm">
        <p>
          <Text t={email.greeting} vars={vars} raw={raw} />
        </p>
        {email.paras.map((p, i) => (
          <p key={i}>
            <Text t={p} vars={vars} raw={raw} />
          </p>
        ))}
        {last && (
          <p className="italic text-gray-600">
            <Text t={lastLine} vars={vars} raw={raw} />
          </p>
        )}
        <span className="inline-block rounded-md bg-indigo-600 px-4 py-2 font-medium text-white">
          <Text t={email.cta} vars={vars} raw={raw} />
        </span>
      </div>
      <div className="border-t px-4 py-2 text-[11px] text-gray-400">
        You get these because Nudges are on for <Text t="{course}" vars={vars} raw={raw} />. ·{" "}
        <u>Fewer Nudges</u> · <u>Turn off email Nudges</u> · <u>Unsubscribe</u>
      </div>
    </div>
  );
}

export default function NudgeCopyPrototype({ loaderData }: Route.ComponentProps) {
  const { firstName, samples } = loaderData;
  const [searchParams] = useSearchParams();
  const voice = VOICES.find((v) => v.key === searchParams.get("variant")) ?? VOICES[0];
  const [sampleIdx, setSampleIdx] = useState(0);
  const [ignored, setIgnored] = useState(0);
  const [lessonsLeft, setLessonsLeft] = useState(2);
  const [raw, setRaw] = useState(false);

  const s = samples[sampleIdx];
  const vars: Vars = {
    name: firstName,
    course: s.course,
    nextLesson: s.firstLesson,
    lessonsLeft: lessonsLeft === 1 ? "1 lesson" : `${lessonsLeft} lessons`,
    quiz: s.quiz,
    quizLesson: s.quizLesson,
    score: "55",
    passMark: "70",
  };
  const varsFor = (kind: Kind): Vars => ({
    ...vars,
    nextLesson:
      kind === "neverStarted" ? s.firstLesson : kind === "almostThere" ? s.lastLessons : s.midLesson,
  });

  return (
    <div className="mx-auto max-w-6xl p-6 pb-28">
      <div className="mb-4 rounded-md border-2 border-dashed border-fuchsia-400 bg-fuchsia-50 p-3 text-sm">
        <b>PROTOTYPE</b>: Nudge copy voices. Flip voices with ← → or the bar below. Not real Nudges, nothing is sent.
      </div>

      <h1 className="text-2xl font-bold">
        Voice {voice.key}: {voice.name}
      </h1>
      <ul className="mb-4 mt-1 list-disc pl-5 text-sm text-gray-600">
        {voice.rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      <div className="sticky top-0 z-10 mb-6 flex flex-wrap items-center gap-4 rounded-md bg-white/95 p-3 text-sm shadow ring-1 ring-black/5">
        <label className="flex items-center gap-2">
          Course
          <select className="rounded border px-2 py-1" value={sampleIdx} onChange={(e) => setSampleIdx(Number(e.target.value))}>
            {samples.map((x, i) => (
              <option key={i} value={i}>
                {x.course}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Ignored Nudges in a row
          <select className="rounded border px-2 py-1" value={ignored} onChange={(e) => setIgnored(Number(e.target.value))}>
            <option value={0}>0 (1st Nudge)</option>
            <option value={1}>1 (2nd Nudge)</option>
            <option value={2}>2 (3rd and last Nudge)</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          Lessons left
          <select className="rounded border px-2 py-1" value={lessonsLeft} onChange={(e) => setLessonsLeft(Number(e.target.value))}>
            <option value={2}>2</option>
            <option value={1}>1</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={raw} onChange={(e) => setRaw(e.target.checked)} />
          Show raw templates
        </label>
      </div>

      <div className="space-y-10">
        {KINDS.map(({ kind, label, trigger, repeats }) => {
          const pushes = repeats
            ? (voice.push[kind as "neverStarted" | "goneQuiet"][ignored] ?? [])
            : voice.push[kind as "almostThere" | "failedQuiz"];
          const v = varsFor(kind);
          return (
            <section key={kind}>
              <h2 className="text-lg font-semibold">{label}</h2>
              <p className="mb-3 text-xs text-gray-500">
                {trigger}
                {!repeats && " · copy doesn't change with Ignored Nudges"}
              </p>
              <div className="flex flex-wrap gap-6">
                <div className="space-y-3 rounded-xl bg-gradient-to-br from-slate-300 to-slate-400 p-4">
                  <div className="text-xs font-medium text-slate-700">Web push ({pushes.length} variant{pushes.length === 1 ? "" : "s"})</div>
                  {pushes.map((p, i) => (
                    <PushCard key={i} push={p} vars={v} raw={raw} />
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-700">Email</div>
                  <EmailCard
                    subject={pushes[0].title}
                    preheader={pushes[0].body}
                    email={voice.email[kind]}
                    last={repeats && ignored === 2}
                    lastLine={voice.lastLine}
                    vars={v}
                    raw={raw}
                  />
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <PrototypeSwitcher variants={VOICES.map((x) => ({ key: x.key, name: x.name }))} />
    </div>
  );
}
