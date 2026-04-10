import DefaultSidebar from "./DefaultSidebar.astro";
import PhysicsSidebar from "./Physics.astro";

export const SIDEBAR_MAP: Record<string, any> = {
  physics: PhysicsSidebar,
};

export { DefaultSidebar };
