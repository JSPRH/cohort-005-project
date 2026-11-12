// PROTOTYPE: three structurally different Nudge settings sections for /settings?variant=A|B|C.
// Never merge to main. State is in memory only; nothing is saved.
import { useState } from "react";
import { BellOff, BellRing, Mail, Moon, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { PrototypeSwitcher } from "~/components/prototype-switcher";
import { cn } from "~/lib/utils";

type Push = "on" | "off" | "blocked" | "needs-home-screen" | "not-asked";
type Frequency = "normal" | "fewer";

type NudgeSettingsState = {
  push: Push;
  email: boolean;
  frequency: Frequency;
  quietStart: string;
  quietEnd: string;
  timezone: string;
  mutedCourseIds: number[];
};

export type SettingsCourse = { id: number; title: string };

export const SETTINGS_VARIANTS = [
  { key: "A", name: "One card, every control" },
  { key: "B", name: "Per-course table" },
  { key: "C", name: "One dial + details" },
];

const TIMEZONES = [
  "Europe/Vienna",
  "Europe/Berlin",
  "Europe/London",
  "America/New_York",
  "Asia/Kolkata",
];

const PUSH_STATES: Push[] = ["not-asked", "on", "off", "blocked", "needs-home-screen"];

export function NudgeSettingsPrototype({
  variant,
  courses,
}: {
  variant: string;
  courses: SettingsCourse[];
}) {
  const [state, setState] = useState<NudgeSettingsState>({
    push: "on",
    email: true,
    frequency: "normal",
    quietStart: "21:00",
    quietEnd: "09:00",
    timezone: "Europe/Vienna",
    mutedCourseIds: [],
  });
  const set = (patch: Partial<NudgeSettingsState>) =>
    setState((s) => ({ ...s, ...patch }));

  const props = { state, set, courses };

  return (
    <>
      {variant === "A" && <VariantA {...props} />}
      {variant === "B" && <VariantB {...props} />}
      {variant === "C" && <VariantC {...props} />}

      <div className="fixed right-4 bottom-20 z-50 w-72 rounded-lg border-2 border-dashed border-fuchsia-500 bg-background p-3 text-xs shadow-xl">
        <p className="mb-2 font-mono font-bold text-fuchsia-600">
          PROTOTYPE STATE
        </p>
        <label className="mb-2 block">
          Push on this device{" "}
          <select
            value={state.push}
            onChange={(e) => set({ push: e.target.value as Push })}
            className="ml-1 rounded border px-1"
          >
            {PUSH_STATES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <pre className="overflow-x-auto font-mono">
          {JSON.stringify(state, null, 1)}
        </pre>
      </div>

      <PrototypeSwitcher variants={SETTINGS_VARIANTS} label="Settings" />
    </>
  );
}

type Props = {
  state: NudgeSettingsState;
  set: (patch: Partial<NudgeSettingsState>) => void;
  courses: SettingsCourse[];
};

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40",
        checked ? "bg-primary" : "bg-muted-foreground/30"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform",
          checked && "translate-x-5"
        )}
      />
    </button>
  );
}

function PushStatusLine({ push }: { push: Push }) {
  const text: Record<Push, string> = {
    on: "On for this browser.",
    off: "Off.",
    "not-asked": "Not set up on this device yet.",
    blocked:
      "Blocked in your browser settings. Allow notifications for Cadence there, then come back.",
    "needs-home-screen":
      "On iPhone, add Cadence to your Home Screen first (Share → Add to Home Screen).",
  };
  return <p className="text-xs text-muted-foreground">{text[push]}</p>;
}

function QuietHours({ state, set }: Pick<Props, "state" | "set">) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>No Nudges from</span>
      <input
        type="time"
        value={state.quietStart}
        onChange={(e) => set({ quietStart: e.target.value })}
        className="rounded border px-2 py-1"
      />
      <span>to</span>
      <input
        type="time"
        value={state.quietEnd}
        onChange={(e) => set({ quietEnd: e.target.value })}
        className="rounded border px-2 py-1"
      />
      <span>in</span>
      <select
        value={state.timezone}
        onChange={(e) => set({ timezone: e.target.value })}
        className="rounded border px-2 py-1"
      >
        {TIMEZONES.map((tz) => (
          <option key={tz}>{tz}</option>
        ))}
      </select>
    </div>
  );
}

// A: a single card stacked with every control, in the same shape as the Profile card.
function VariantA({ state, set }: Props) {
  const pushToggleable = state.push === "on" || state.push === "off";
  return (
    <Card className="mt-8 max-w-md">
      <CardHeader>
        <h2 className="text-lg font-semibold">Nudges</h2>
        <p className="text-sm text-muted-foreground">
          The odd reminder to get back to your courses.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 font-medium">
                <BellRing className="size-4" /> Push notifications
              </p>
              <PushStatusLine push={state.push} />
            </div>
            {pushToggleable ? (
              <Toggle
                checked={state.push === "on"}
                onChange={(v) => set({ push: v ? "on" : "off" })}
              />
            ) : state.push === "not-asked" ? (
              <Button size="sm" variant="outline" onClick={() => set({ push: "on" })}>
                Turn on
              </Button>
            ) : null}
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 font-medium">
                <Mail className="size-4" /> Email
              </p>
              <p className="text-xs text-muted-foreground">
                Used when push isn&apos;t on.
              </p>
            </div>
            <Toggle checked={state.email} onChange={(v) => set({ email: v })} />
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 font-medium">How often</legend>
          {(["normal", "fewer"] as const).map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={state.frequency === f}
                onChange={() => set({ frequency: f })}
              />
              {f === "normal"
                ? "Normal: up to 3 a week"
                : "Fewer: up to 1 a week"}
            </label>
          ))}
        </fieldset>

        <div className="space-y-2">
          <p className="flex items-center gap-2 font-medium">
            <Moon className="size-4" /> Quiet Hours
          </p>
          <QuietHours state={state} set={set} />
        </div>
      </CardContent>
    </Card>
  );
}

// B: a course × Channel matrix. Per-course mute is first-class; globals sit in the header row.
function VariantB({ state, set, courses }: Props) {
  function toggleCourse(id: number) {
    set({
      mutedCourseIds: state.mutedCourseIds.includes(id)
        ? state.mutedCourseIds.filter((c) => c !== id)
        : [...state.mutedCourseIds, id],
    });
  }
  return (
    <section className="mt-8 max-w-3xl">
      <h2 className="mb-1 text-lg font-semibold">Nudges</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Choose which courses we nudge you about, and how.
      </p>
      <table className="w-full overflow-hidden rounded-lg border text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="p-3">Course</th>
            <th className="p-3">
              <span className="flex items-center gap-1">
                <BellRing className="size-4" /> Push
              </span>
            </th>
            <th className="p-3">
              <span className="flex items-center gap-1">
                <Mail className="size-4" /> Email
              </span>
            </th>
            <th className="p-3">Nudge me</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t bg-muted/20 font-medium">
            <td className="p-3">All courses</td>
            <td className="p-3">
              <Toggle
                checked={state.push === "on"}
                disabled={state.push !== "on" && state.push !== "off"}
                onChange={(v) => set({ push: v ? "on" : "off" })}
              />
            </td>
            <td className="p-3">
              <Toggle checked={state.email} onChange={(v) => set({ email: v })} />
            </td>
            <td className="p-3">
              <select
                value={state.frequency}
                onChange={(e) => set({ frequency: e.target.value as Frequency })}
                className="rounded border px-2 py-1"
              >
                <option value="normal">Normal</option>
                <option value="fewer">Fewer</option>
              </select>
            </td>
          </tr>
          {courses.map((c) => {
            const muted = state.mutedCourseIds.includes(c.id);
            return (
              <tr key={c.id} className={cn("border-t", muted && "text-muted-foreground")}>
                <td className="p-3">{c.title}</td>
                <td className="p-3" colSpan={2}>
                  {muted ? "Muted" : "Follows “All courses”"}
                </td>
                <td className="p-3">
                  <Button size="sm" variant="ghost" onClick={() => toggleCourse(c.id)}>
                    {muted ? (
                      "Unmute"
                    ) : (
                      <>
                        <BellOff className="mr-1 size-4" /> Mute
                      </>
                    )}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2">
        <PushStatusLine push={state.push} />
      </div>
      <div className="mt-4 rounded-lg border p-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Moon className="size-4" /> Quiet Hours
        </p>
        <QuietHours state={state} set={set} />
      </div>
    </section>
  );
}

// C: one big choice (Normal / Fewer / Off) up front; Channels and Quiet Hours behind "Details".
function VariantC({ state, set }: Props) {
  const off = !state.email && state.push !== "on";
  const level = off ? "off" : state.frequency;
  function pick(l: "normal" | "fewer" | "off") {
    if (l === "off") set({ email: false, push: state.push === "on" ? "off" : state.push });
    else set({ frequency: l, email: true });
  }
  const options = [
    { key: "normal", title: "Normal", body: "Up to 3 a week. We'll keep you moving." },
    { key: "fewer", title: "Fewer", body: "Up to 1 a week. Just the gentle stuff." },
    { key: "off", title: "Off", body: "No Nudges. We'll miss you, quietly." },
  ] as const;
  return (
    <section className="mt-8 max-w-2xl">
      <h2 className="mb-4 text-lg font-semibold">How much should we nudge you?</h2>
      <div className="grid grid-cols-3 gap-0 overflow-hidden rounded-xl border">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => pick(o.key)}
            className={cn(
              "border-r p-4 text-left last:border-r-0",
              level === o.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            <p className="font-semibold">{o.title}</p>
            <p className="mt-1 text-xs opacity-80">{o.body}</p>
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {off ? (
          "You won't get any Nudges."
        ) : (
          <>
            Sent by{" "}
            <strong>
              {state.push === "on" ? (
                <>
                  <Smartphone className="inline size-4" /> notification
                </>
              ) : (
                <>
                  <Mail className="inline size-4" /> email
                </>
              )}
            </strong>
            , never between {state.quietStart} and {state.quietEnd} (
            {state.timezone}).
          </>
        )}
      </p>
      <details className="mt-4 rounded-lg border p-4">
        <summary className="cursor-pointer text-sm font-medium">Details</summary>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Push notifications on this device</p>
              <PushStatusLine push={state.push} />
            </div>
            <Toggle
              checked={state.push === "on"}
              disabled={state.push !== "on" && state.push !== "off"}
              onChange={(v) => set({ push: v ? "on" : "off" })}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Email when push isn&apos;t on</p>
            <Toggle checked={state.email} onChange={(v) => set({ email: v })} />
          </div>
          <QuietHours state={state} set={set} />
        </div>
      </details>
    </section>
  );
}
