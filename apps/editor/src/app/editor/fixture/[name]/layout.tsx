import { notFound } from "next/navigation";
import {
  buildTransformsParentingFixture,
  buildMaterialsLightsFixture,
  buildAnimationFixture,
  buildEventsTriggersFixture,
  buildCharacterStubFixture,
  buildTimelineStubFixture,
  buildAdversarialFixture,
} from "@riff3d/fixtures";

/**
 * Fixture route layout — serves golden fixture ECSON for E2E visual regression tests.
 *
 * Maps fixture names (URL slug) to builder functions from @riff3d/fixtures.
 * Injects the built SceneDocument via the same __RIFF3D_PROJECT_DATA__ script
 * tag that /editor/[projectId] uses, so the client page.tsx works identically.
 *
 * No database or auth required — fixture data is generated at request time.
 * This route is used by Playwright visual tests (dual-adapter.visual.ts,
 * fixture-render.visual.ts) which navigate to /editor/fixture/{name}.
 */

const FIXTURE_BUILDERS: Record<string, () => unknown> = {
  "transforms-parenting": buildTransformsParentingFixture,
  "materials-lights": buildMaterialsLightsFixture,
  animation: buildAnimationFixture,
  "events-triggers": buildEventsTriggersFixture,
  "character-stub": buildCharacterStubFixture,
  "timeline-stub": buildTimelineStubFixture,
  adversarial: buildAdversarialFixture,
};

export default async function FixtureLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;

  const builder = FIXTURE_BUILDERS[name];
  if (!builder) {
    notFound();
  }

  const ecson = builder();

  const projectData = JSON.stringify({
    projectId: `fixture-${name}`,
    projectName: `Fixture: ${name}`,
    isOwner: true,
    isPublic: true,
    ecson,
  });

  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--background)]">
      <script
        id="__RIFF3D_PROJECT_DATA__"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: projectData }}
      />
      {children}
    </div>
  );
}
