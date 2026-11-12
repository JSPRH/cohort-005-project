// PROTOTYPE: sends the opt-in switcher to the host page for each variant. Never merge to main.
import { data, redirect } from "react-router";
import { asc, eq } from "drizzle-orm";
import type { Route } from "./+types/prototype.nudge-optin";
import { db } from "~/db";
import { courses, enrollments, lessons, modules } from "~/db/schema";
import { getCurrentUserId } from "~/lib/session";

export async function loader({ request }: Route.LoaderArgs) {
  const optin = new URL(request.url).searchParams.get("optin") ?? "A";
  const userId = await getCurrentUserId(request);
  if (!userId) {
    throw data("Select a user from the DevUI panel.", { status: 401 });
  }

  const enrolled = db
    .select({ courseId: courses.id, slug: courses.slug })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(eq(enrollments.userId, userId))
    .get();
  if (!enrolled) {
    throw data("Pick a Student with at least one Enrollment.", { status: 400 });
  }

  if (optin === "A") throw redirect(`/courses/${enrolled.slug}/welcome?optin=A`);
  if (optin === "C") throw redirect(`/dashboard?optin=C`);

  const firstLesson = db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, enrolled.courseId))
    .orderBy(asc(modules.position), asc(lessons.position))
    .get();
  throw redirect(
    `/courses/${enrolled.slug}/lessons/${firstLesson?.id ?? ""}?optin=B`
  );
}
