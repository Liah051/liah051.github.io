# MapEditor Component

This is a standalone React component for the Aspa Map Maker. It can be easily integrated into Astro, Next.js, or any React-based project.

## Dependencies

To use this component, you need to install the following libraries:

```bash
npm install lucide-react html-to-image framer-motion sonner
```

## How to use in Astro

1. Place the `MapEditor` folder into your `src/components/` directory.
2. In your Astro page:

```astro
---
import MapEditor from '../components/MapEditor/MapEditor';
---

<Layout title="Map Editor">
  <MapEditor client:only="react" />
</Layout>
```

Note: Since it uses browser APIs (DOM, FileReader), make sure to use `client:only="react"` in Astro.

## Asset Configuration

The component automatically loads panel images from `src/assets/panels/*.png`. Ensure your folder structure matches or adjust the `import.meta.glob` path in `MapEditor.tsx`.
