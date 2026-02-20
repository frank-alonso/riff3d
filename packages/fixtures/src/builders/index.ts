// Builder API
export { SceneBuilder, EntityBuilder, createDeterministicIdGenerator } from "./builder";

// Golden fixtures (6 clean + 1 adversarial)
export { buildTransformsParentingFixture } from "./transforms-parenting";
export { buildMaterialsLightsFixture } from "./materials-lights";
export { buildAnimationFixture } from "./animation";
export { buildEventsTriggersFixture } from "./events-triggers";
export { buildCharacterStubFixture } from "./character-stub";
export { buildTimelineStubFixture } from "./timeline-stub";
export { buildAdversarialFixture } from "./adversarial";
