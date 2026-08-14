import DefaultSidebar from "./DefaultSidebar.astro";
import PhysicsSidebar from "./PhysicsSidebar.astro";
import AstralPartySidebar from "./AstralPartySidebar.astro";

export const SIDEBAR_MAP: Record<string, any> = {
  physics: PhysicsSidebar,
  astralparty: AstralPartySidebar,
};

export { DefaultSidebar };
