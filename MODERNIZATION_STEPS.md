# Modernization UI Steps

## 1. Install framer-motion
```bash
cd frontend
npm install framer-motion
```

## 2. Update imports in frontend/src/app/page.tsx
- Add: `import { motion } from 'framer-motion';`
- Add to lucide-react imports: `Download`

## 3. Changes to make:
- FAB Button: Add gradient, framer-motion animations (whileHover, whileTap)
- Project Cards: Add video thumbnail, better shadows, status badge, outline download button
- Dialogue Cards: Add framer-motion slide-in animations, better active states with scale
- All cards: Add smooth animations on mount (fade-in, slide-up)

## Key Components to Update:
1. FAB Button (around line 570)
2. Project Cards (around line 400)
3. Dialogue Cards (around line 650)
