import DefaultSidebar from "./DefaultSidebar.astro";
import PhysicsSidebar from "./PhysicsSidebar.astro";

export const SIDEBAR_MAP: Record<string, any> = {
  physics: PhysicsSidebar,
};

export { DefaultSidebar };
