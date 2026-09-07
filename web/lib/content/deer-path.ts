/**
 * Deer Path Photography — Chosen Experiences partnership content.
 * Photography sourced from Deer Path DSC originals (DSC_2088 hero locked).
 */

export const deerPathExperience = {
  id: "deer-path-photography",
  eyebrow: "Chosen Experiences",
  heading: "Deer Path Photography",
  statementLines: [
    "Some moments are just so short",
    "that we need to capture.",
  ] as const,
  support:
    "Beautiful, natural photography for families, newborns and life's most meaningful moments — in and around London.",
  attribution: "With Juno and Andrew",
  cta: {
    label: "Discover Deer Path",
    href: "https://www.deerpathphoto.com/",
  },
  images: {
    /** Locked hero — DSC_2088 */
    hero: {
      src: "/partnerships/deer-path-photography/hero-garden-path.jpg",
      alt: "A child walking a brick garden path carrying a basket of fresh vegetables",
      source: "DSC_2088",
    },
    /** Supporting — DSC_2024 bench / squash */
    supportPrimary: {
      src: "/partnerships/deer-path-photography/support-garden-bench.jpg",
      alt: "A child sitting on a garden bench holding a yellow squash beside a basket of produce",
      source: "DSC_2024",
    },
    /** Supporting — DSC_2221 intimate tomato moment */
    supportSecondary: {
      src: "/partnerships/deer-path-photography/support-tomato-moment.jpg",
      alt: "A close portrait of a child tasting a small tomato in the garden",
      source: "DSC_2221",
    },
  },
} as const;

export type DeerPathExperienceContent = typeof deerPathExperience;
