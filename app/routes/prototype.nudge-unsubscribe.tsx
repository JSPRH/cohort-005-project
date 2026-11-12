// PROTOTYPE: where the email footer's "Unsubscribe" link lands. Never merge to main.
// Three variants via ?variant=A|B|C. The real page would be reached by a signed token in the
// link (no login); here the current DevUI user and their first Enrollment stand in.
// The List-Unsubscribe / List-Unsubscribe-Post (RFC 8058) header that Gmail's and Yahoo's
// one-click button uses never shows a page: it just turns email Nudges off.
import { useState } from "react";
import { data, useSearchParams } from "react-router";
import { eq } from "drizzle-orm";
import { CheckCircle2, MailX } from "lucide-react";
import type { Route } from "./+types/prototype.nudge-unsubscribe";
import { db } from "~/db";
import { courses, enrollments, users } from "~/db/schema";
import { getCurrentUserId } from "~/lib/session";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { PrototypeSwitcher } from "~/components/prototype-switcher";

const VARIANTS = [
  { key: "A", name: "One click, done" },
  { key: "B", name: "Choose before you go" },
  { key: "C", name: "Done, plus mini settings" },
];

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) throw data("Select a user from the DevUI panel.", { status: 401 });
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  const course = db
    .select({ title: courses.title })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(eq(enrollments.userId, userId))
    .get();
  return {
    email: user?.email ?? "student@example.com",
    // the course the clicked Nudge email was about
    courseTitle: course?.title ?? "Your course",
  };
}

type Outcome = "email-off" | "fewer" | "course-muted" | "all-off" | "nothing";

export default function NudgeUnsubscribePrototype({
  loaderData,
}: Route.ComponentProps) {
  const variant = useSearchParams()[0].get("variant") ?? "A";
  // A and C act on landing; B waits for a choice
  const [outcome, setOutcome] = useState<Outcome>(
    variant === "B" ? "nothing" : "email-off"
  );
  const props = { ...loaderData, outcome, setOutcome };

  return (
    <div className="flex min-h-screen items-start justify-center bg-muted/30 p-6 pt-20">
      <div className="w-full max-w-md" key={variant}>
        <p className="mb-6 text-center text-xl font-bold">Cadence</p>
        {variant === "A" && <VariantA {...props} />}
        {variant === "B" && <VariantB {...props} />}
        {variant === "C" && <VariantC {...props} />}
      </div>

      <div className="fixed right-4 bottom-20 z-50 w-60 rounded-lg border-2 border-dashed border-fuchsia-500 bg-background p-3 font-mono text-xs shadow-xl">
        <p className="mb-1 font-bold text-fuchsia-600">PROTOTYPE STATE</p>
        outcome: {outcome}
      </div>
      <PrototypeSwitcher variants={VARIANTS} label="Unsubscribe" />
    </div>
  );
}

type Props = {
  email: string;
  courseTitle: string;
  outcome: Outcome;
  setOutcome: (o: Outcome) => void;
};

function VariantA({ email, outcome, setOutcome }: Props) {
  if (outcome === "nothing") {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="font-medium">Welcome back. Email Nudges are on again.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <MailX className="mx-auto mb-4 size-10 text-muted-foreground" />
        <h1 className="text-2xl font-bold">
          {outcome === "fewer" ? "Fewer it is." : "Done. No more Nudge emails."}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {outcome === "fewer"
            ? `We'll email ${email} at most once a week.`
            : `We won't email ${email} about your courses again. Receipts and account emails still arrive.`}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setOutcome("nothing")}>
            Undo
          </Button>
          {outcome !== "fewer" && (
            <Button variant="ghost" size="sm" onClick={() => setOutcome("fewer")}>
              Actually, just fewer
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function VariantB({ courseTitle, outcome, setOutcome }: Props) {
  const [choice, setChoice] = useState<Outcome>("fewer");
  if (outcome !== "nothing") {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 size-8 text-green-600" />
          <p className="font-medium">
            {
              {
                fewer: "Fewer Nudges, at most one a week.",
                "course-muted": `No more Nudges about ${courseTitle}.`,
                "email-off": "No more Nudge emails. Push stays as it is.",
                "all-off": "No more Nudges at all.",
                nothing: "",
              }[outcome]
            }
          </p>
        </CardContent>
      </Card>
    );
  }
  const options: { key: Outcome; label: string }[] = [
    { key: "fewer", label: "Send fewer (at most 1 a week)" },
    { key: "course-muted", label: `Stop Nudges about ${courseTitle} only` },
    { key: "email-off", label: "Stop Nudge emails" },
    { key: "all-off", label: "Stop all Nudges, push too" },
  ];
  return (
    <Card>
      <CardContent className="p-8">
        <h1 className="text-xl font-bold">Too much? Tell us what to change.</h1>
        <div className="mt-5 space-y-3">
          {options.map((o) => (
            <label
              key={o.key}
              className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm has-checked:border-primary has-checked:bg-primary/5"
            >
              <input
                type="radio"
                name="choice"
                checked={choice === o.key}
                onChange={() => setChoice(o.key)}
              />
              {o.label}
            </label>
          ))}
        </div>
        <Button className="mt-6 w-full" onClick={() => setOutcome(choice)}>
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

function VariantC({ email, courseTitle, setOutcome }: Props) {
  const [prefs, setPrefs] = useState({
    email: false,
    fewer: false,
    courseMuted: false,
  });
  function update(patch: Partial<typeof prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setOutcome(
      !next.email ? "email-off" : next.courseMuted ? "course-muted" : next.fewer ? "fewer" : "nothing"
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4 text-sm dark:bg-green-950/30">
        <CheckCircle2 className="size-5 shrink-0 text-green-600" />
        <span>
          {prefs.email
            ? "Saved."
            : `Unsubscribed. ${email} gets no more Nudge emails.`}
        </span>
      </div>
      <Card>
        <CardContent className="space-y-3 p-6 text-sm">
          <p className="font-medium">Changed your mind? Fine-tune instead:</p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={prefs.email}
              onChange={(e) => update({ email: e.target.checked })}
            />
            Email Nudges
          </label>
          <label className="flex items-center gap-2 pl-6">
            <input
              type="checkbox"
              disabled={!prefs.email}
              checked={prefs.fewer}
              onChange={(e) => update({ fewer: e.target.checked })}
            />
            Fewer (at most 1 a week)
          </label>
          <label className="flex items-center gap-2 pl-6">
            <input
              type="checkbox"
              disabled={!prefs.email}
              checked={prefs.courseMuted}
              onChange={(e) => update({ courseMuted: e.target.checked })}
            />
            Not about {courseTitle}
          </label>
          <p className="pt-2 text-xs text-muted-foreground">
            More options (push, Quiet Hours) in{" "}
            <a href="/settings" className="underline">
              settings
            </a>{" "}
            once you&apos;re signed in.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
