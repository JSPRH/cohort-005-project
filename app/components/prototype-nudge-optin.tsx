// PROTOTYPE: when and how we ask a Student to opt in to Nudges. Never merge to main.
// Three variants of the *moment*, each mounted on its natural host page via `?optin=A|B|C`:
//   A (At enrolment)        -> /courses/:slug/welcome
//   B (After first lesson)  -> /courses/:slug/lessons/:lessonId
//   C (Email first)         -> /dashboard (arriving from an email Nudge)
// The browser permission prompt is simulated so the flow can be replayed. Nothing is saved.
import { useState } from "react";
import { BellRing, Mail, Share, SquarePlus, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { PrototypeSwitcher } from "~/components/prototype-switcher";

type Device = "desktop" | "android" | "iphone-tab" | "iphone-home";
type Permission = "default" | "granted" | "denied" | "unsupported";
type Step =
  | "pre-prompt"
  | "browser-prompt"
  | "add-to-home-screen"
  | "done-push"
  | "done-email"
  | "dismissed";

const DEVICES: { key: Device; label: string }[] = [
  { key: "desktop", label: "Desktop Chrome" },
  { key: "android", label: "Android Chrome" },
  { key: "iphone-tab", label: "iPhone, Safari tab" },
  { key: "iphone-home", label: "iPhone, Home Screen app" },
];

export const OPT_IN_VARIANTS = [
  { key: "A", name: "At enrolment", href: "/prototype/nudge-optin?optin=A" },
  { key: "B", name: "After first lesson", href: "/prototype/nudge-optin?optin=B" },
  { key: "C", name: "Email first, push later", href: "/prototype/nudge-optin?optin=C" },
];

function browserTimezone() {
  if (typeof Intl === "undefined") return "Europe/Vienna";
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function NudgeOptInPrototype({
  variant,
  courseTitle,
}: {
  variant: "A" | "B" | "C";
  courseTitle: string;
}) {
  const [device, setDevice] = useState<Device>("desktop");
  const [step, setStep] = useState<Step>("pre-prompt");
  const [permission, setPermission] = useState<Permission>("default");
  // Variant C turns email Nudges on at enrolment; A and B only start Nudging on a yes.
  const [emailOn, setEmailOn] = useState(variant === "C");
  const [pushOn, setPushOn] = useState(false);
  const [timezone, setTimezone] = useState<string | null>(null);

  const pushPossible = device !== "iphone-tab";

  function reset(nextDevice = device) {
    setDevice(nextDevice);
    setStep("pre-prompt");
    setPermission(nextDevice === "iphone-tab" ? "unsupported" : "default");
    setEmailOn(variant === "C");
    setPushOn(false);
    setTimezone(null);
  }

  function sayYes() {
    setTimezone(browserTimezone());
    if (!pushPossible) {
      setStep("add-to-home-screen");
      return;
    }
    setStep("browser-prompt");
  }

  function browserAnswer(allow: boolean) {
    setPermission(allow ? "granted" : "denied");
    if (allow) {
      setPushOn(true);
      setStep("done-push");
    } else {
      // Blocked in the browser: fall back to email (A/B ask for that explicitly below)
      setEmailOn(true);
      setStep("done-email");
    }
  }

  function emailInstead() {
    setTimezone(browserTimezone());
    setEmailOn(true);
    setStep("done-email");
  }

  return (
    <>
      <div className="my-6 text-left">
        {step === "pre-prompt" && (
          <PrePrompt
            variant={variant}
            courseTitle={courseTitle}
            onYes={sayYes}
            onEmail={emailInstead}
            onDismiss={() => setStep("dismissed")}
          />
        )}

        {step === "browser-prompt" && (
          <SimulatedBrowserPrompt onAnswer={browserAnswer} />
        )}

        {step === "add-to-home-screen" && (
          <AddToHomeScreen
            onEmail={emailInstead}
            onDone={() => reset("iphone-home")}
          />
        )}

        {(step === "done-push" || step === "done-email") && (
          <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm dark:bg-green-950/30">
            <p className="font-medium">
              {step === "done-push"
                ? "Done! We'll ping you here if you drift off."
                : permission === "denied"
                  ? "No problem, we'll use email instead."
                  : "Done! We'll email you if you drift off."}
            </p>
            <p className="mt-1 text-muted-foreground">
              Nudges follow {timezone} time · no Nudges 21:00–09:00 ·{" "}
              <a href="/settings" className="underline">
                change in settings
              </a>
            </p>
          </div>
        )}

        {step === "dismissed" && (
          <p className="text-sm text-muted-foreground">
            (Pre-prompt dismissed. Prototype question: when, if ever, do we
            ask again?)
          </p>
        )}
      </div>

      {/* Surface the state */}
      <div className="fixed right-4 bottom-20 z-50 w-72 rounded-lg border-2 border-dashed border-fuchsia-500 bg-background p-3 text-xs shadow-xl">
        <p className="mb-2 font-mono font-bold text-fuchsia-600">
          PROTOTYPE STATE
        </p>
        <label className="mb-2 block">
          Device{" "}
          <select
            value={device}
            onChange={(e) => reset(e.target.value as Device)}
            className="ml-1 rounded border px-1"
          >
            {DEVICES.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <dl className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono">
          <dt>step</dt>
          <dd>{step}</dd>
          <dt>Notification.permission</dt>
          <dd>{permission}</dd>
          <dt>push Channel</dt>
          <dd>{pushOn ? "on" : "off"}</dd>
          <dt>email Channel</dt>
          <dd>{emailOn ? "on" : "off"}</dd>
          <dt>timezone saved</dt>
          <dd>{timezone ?? "—"}</dd>
          <dt>Nudges go by</dt>
          <dd>{pushOn ? "push" : emailOn ? "email" : "nothing"}</dd>
        </dl>
        <button
          onClick={() => reset()}
          className="mt-2 underline text-fuchsia-600"
        >
          Replay
        </button>
      </div>

      <PrototypeSwitcher
        variants={OPT_IN_VARIANTS}
        param="optin"
        label="Opt-in moment"
      />
    </>
  );
}

function PrePrompt({
  variant,
  courseTitle,
  onYes,
  onEmail,
  onDismiss,
}: {
  variant: "A" | "B" | "C";
  courseTitle: string;
  onYes: () => void;
  onEmail: () => void;
  onDismiss: () => void;
}) {
  if (variant === "A") {
    return (
      <div className="rounded-xl border bg-muted/40 p-5">
        <div className="flex items-start gap-3">
          <BellRing className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold">
              Want a poke if you wander off?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Life happens. We&apos;ll send the odd reminder about{" "}
              {courseTitle}, never more than one a day, and never at night.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={onYes}>
                Yes, nudge me
              </Button>
              <Button size="sm" variant="outline" onClick={onEmail}>
                <Mail className="mr-1 size-4" /> Email me instead
              </Button>
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                No thanks
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "B") {
    return (
      <div className="relative rounded-xl bg-primary p-5 text-primary-foreground shadow-lg">
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
        <p className="text-lg font-bold">🎉 One down!</p>
        <p className="mt-1 text-sm opacity-90">
          Most people stall around lesson three. Let us be the annoying
          friend who checks in, so you don&apos;t.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={onYes}>
            Keep me on track
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-primary-foreground hover:bg-white/10"
            onClick={onEmail}
          >
            By email, please
          </Button>
        </div>
      </div>
    );
  }

  // C: email is already on (told at enrolment). Push is offered only once the
  // Student has shown an email Nudge works, by clicking through from one.
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border-l-4 border-primary bg-muted/40 px-4 py-3">
      <p className="text-sm">
        <span className="font-medium">Welcome back!</span> That email worked.
        Want the next one as a quick notification instead?
      </p>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={onYes}>
          Switch to notifications
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Keep email
        </Button>
      </div>
    </div>
  );
}

function SimulatedBrowserPrompt({
  onAnswer,
}: {
  onAnswer: (allow: boolean) => void;
}) {
  return (
    <div className="w-80 rounded-md border bg-white p-4 text-sm text-black shadow-2xl">
      <p className="mb-1 text-xs text-gray-500">
        (simulated browser prompt) localhost wants to
      </p>
      <p className="mb-4 flex items-center gap-2">
        <BellRing className="size-4" /> Show notifications
      </p>
      <div className="flex justify-end gap-2">
        <button
          onClick={() => onAnswer(false)}
          className="rounded border px-3 py-1"
        >
          Block
        </button>
        <button
          onClick={() => onAnswer(true)}
          className="rounded bg-blue-600 px-3 py-1 text-white"
        >
          Allow
        </button>
      </div>
    </div>
  );
}

function AddToHomeScreen({
  onEmail,
  onDone,
}: {
  onEmail: () => void;
  onDone: () => void;
}) {
  return (
    <div className="rounded-xl border p-5 text-sm">
      <p className="font-semibold">On iPhone, notifications need one extra step</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li className="flex items-center gap-1">
          Tap <Share className="inline size-4" /> Share in Safari
        </li>
        <li className="flex items-center gap-1">
          Choose <SquarePlus className="inline size-4" /> Add to Home Screen
        </li>
        <li>Open Cadence from your Home Screen and tap “Yes, nudge me” again</li>
      </ol>
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={onEmail}>
          Just email me
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          (simulate: I added it)
        </Button>
      </div>
    </div>
  );
}
