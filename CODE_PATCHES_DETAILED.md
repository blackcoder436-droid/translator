# Detailed Code Patches - Movie Translator Frontend Modernization

## Complete Before/After Code Sections

---

## SECTION 1: Imports (Lines 1-10)

### ❌ BEFORE:
```tsx
'use client';

import { useEffect, Suspense, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from "next/image";
import { User, Settings, Moon, Sun, Plus, Trash2, Edit } from "lucide-react";
import { useTheme } from "next-themes";
import axios from 'axios';
```

### ✅ AFTER:
```tsx
'use client';

import { useEffect, Suspense, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from "next/image";
import { User, Settings, Moon, Sun, Plus, Trash2, Edit, Download } from "lucide-react";
import { useTheme } from "next-themes";
import axios from 'axios';
import { motion } from 'framer-motion';
```

### 📝 CHANGES:
- Added `Download` to lucide-react icons
- Added `import { motion } from 'framer-motion'`

---

## SECTION 2: FAB Button (Lines ~520-540)

### ❌ BEFORE:
```tsx
      {/* Floating Action Button */}
      {isLoggedIn && (
        <button
          onClick={() => setShowModal(true)}
          className="fixed bottom-16 right-4 bg-blue-600 text-white rounded-md px-4 py-3 shadow-lg hover:bg-blue-700 md:bottom-4 md:hidden flex items-center space-x-2"
          title="Generate SRT"
        >
          <Plus className="h-5 w-5" />
          <span className="font-medium">Generate SRT</span>
        </button>
      )}
```

### ✅ AFTER:
```tsx
      {/* Floating Action Button */}
      {isLoggedIn && (
        <motion.button
          onClick={() => setShowModal(true)}
          className="fixed bottom-16 right-4 md:bottom-4 md:hidden flex items-center space-x-2 px-4 py-3 rounded-full text-white font-medium shadow-xl"
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          }}
          whileHover={{ 
            scale: 1.1,
            boxShadow: '0 20px 25px rgba(59, 130, 246, 0.5)',
          }}
          whileTap={{ scale: 0.95 }}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
          title="Generate SRT"
        >
          <Plus className="h-5 w-5" />
          <span>Generate SRT</span>
        </motion.button>
      )}
```

### 📝 ANIMATION PROPS EXPLAINED:

| Prop | Value | Effect |
|------|-------|--------|
| `whileHover` | `scale: 1.1, boxShadow: '0 20px 25px rgba(59, 130, 246, 0.5)'` | 10% larger + glow shadow on hover |
| `whileTap` | `scale: 0.95` | 5% smaller when clicked (press feedback) |
| `initial` | `y: 100, opacity: 0` | Starts below screen, invisible |
| `animate` | `y: 0, opacity: 1` | Moves to normal position, becomes visible |
| `transition` | `type: 'spring', stiffness: 100, damping: 15` | Spring animation (bouncy) |

### 🎨 STYLING CHANGES:
- `rounded-md` → `rounded-full` (pill shape)
- `bg-blue-600 hover:bg-blue-700` → `linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)`
- `shadow-lg` → `shadow-xl`
- Added `style` prop with gradient background

---

## SECTION 3: Project Cards (Lines ~450-500)

### ❌ BEFORE:
```tsx
            {/* Recent Projects */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeTab === 'local' ? (
                projects.length > 0 ? (
                  projects.map((project, index) => (
                    <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 cursor-pointer" onClick={() => {
                          // open viewer for this project
                          setViewerProject(project);
                          // fetch and parse srt
                          (async () => {
                            try {
                              if (!project.srtPath) { setSrtCues([]); return; }
                              const url = `http://localhost:5001/uploads/${project.srtPath}`;
                              const txt = await (await fetch(url)).text();
                              const cues = parseSrt(txt);
                              setSrtCues(cues);
                              setCurrentCueIndex(-1);
                            } catch (e) {
                              console.warn('Failed to load srt', e);
                              setSrtCues([]);
                            }
                          })();
                        }}>
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{project.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Extracted on {project.date.toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {project.id && (
                              <button
                                onClick={async () => {
                                  if (!confirm('Delete this project?')) return;
                                  try {
                                    await axios.delete(`http://localhost:5001/api/projects/${project.id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                                    setProjects(prev => prev.filter(p => p.id !== project.id));
                                  } catch (err) {
                                    alert('Delete failed');
                                  }
                                }}
                                className="p-2 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-700"
                                title="Delete project"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            )}
                            <a
                              href={`http://localhost:5001/uploads/${project.srtPath}`}
                              download
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                            >
                              Download SRT
                            </a>
                          </div>
                        </div>
                      </div>
                  ))
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No translations yet. Click + to start a new one.</p>
                  </div>
                )
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
                  <p className="text-gray-500 dark:text-gray-400">Cloud projects feature coming soon.</p>
                </div>
              )}
            </div>
```

### ✅ AFTER:
```tsx
            {/* Recent Projects */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeTab === 'local' ? (
                projects.length > 0 ? (
                  projects.map((project, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.4 }}
                      onClick={() => {
                        // open viewer for this project
                        setViewerProject(project);
                        // fetch and parse srt
                        (async () => {
                          try {
                            if (!project.srtPath) { setSrtCues([]); return; }
                            const url = `http://localhost:5001/uploads/${project.srtPath}`;
                            const txt = await (await fetch(url)).text();
                            const cues = parseSrt(txt);
                            setSrtCues(cues);
                            setCurrentCueIndex(-1);
                          } catch (e) {
                            console.warn('Failed to load srt', e);
                            setSrtCues([]);
                          }
                        })();
                      }}
                      whileHover={{ y: -4 }}
                      className="group cursor-pointer"
                    >
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl dark:shadow-lg dark:hover:shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-shadow duration-300">
                        {/* Thumbnail placeholder with gradient */}
                        <div className="h-40 bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 relative overflow-hidden group-hover:scale-105 transition-transform duration-300">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-white text-4xl opacity-30">🎬</div>
                          </div>
                          {/* Status badge */}
                          <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                            Ready
                          </div>
                        </div>

                        <div className="p-5">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 truncate">{project.name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Extracted on {project.date.toLocaleDateString()}</p>

                          <div className="flex items-center gap-2">
                            {project.id && (
                              <motion.button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!confirm('Delete this project?')) return;
                                  try {
                                    await axios.delete(`http://localhost:5001/api/projects/${project.id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                                    setProjects(prev => prev.filter(p => p.id !== project.id));
                                  } catch (err) {
                                    alert('Delete failed');
                                  }
                                }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="p-2.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title="Delete project"
                              >
                                <Trash2 className="h-5 w-5" />
                              </motion.button>
                            )}
                            <motion.a
                              href={`http://localhost:5001/uploads/${project.srtPath}`}
                              download
                              onClick={(e) => e.stopPropagation()}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium text-sm transition-colors"
                            >
                              <Download className="h-4 w-4" />
                              Download SRT
                            </motion.a>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="col-span-1 md:col-span-2 lg:col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center"
                  >
                    <p className="text-gray-500 dark:text-gray-400">No translations yet. Click + to start a new one.</p>
                  </motion.div>
                )
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-1 md:col-span-2 lg:col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center"
                >
                  <p className="text-gray-500 dark:text-gray-400">Cloud projects feature coming soon.</p>
                </motion.div>
              )}
            </div>
```

### 📝 KEY CHANGES:

#### 1. **Wrapper Animation**
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.1, duration: 0.4 }}
  whileHover={{ y: -4 }}
  className="group cursor-pointer"
>
```
- Fades in and slides up 20px
- Staggered by 100ms per card (index * 0.1)
- Lifts 4px on hover

#### 2. **Thumbnail Section**
```tsx
<div className="h-40 bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 relative overflow-hidden group-hover:scale-105 transition-transform duration-300">
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="text-white text-4xl opacity-30">🎬</div>
  </div>
  {/* Status badge */}
  <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
    Ready
  </div>
</div>
```
- Gradient background (blue-purple-pink)
- Movie emoji as placeholder
- Status badge in top-right
- Scales 105% on hover

#### 3. **Button Styling**
```tsx
<motion.a
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium text-sm transition-colors"
>
  <Download className="h-4 w-4" />
  Download SRT
</motion.a>
```
- Changed from solid green (`bg-green-600`) to outline blue (`border-2 border-blue-600`)
- Added Download icon
- Added hover/tap animations

---

## SECTION 4: Dialogue Cards (Lines ~680-720)

### ❌ BEFORE:
```tsx
                <div ref={cueListRef} className="dialogue-container">
                  {srtCues.length === 0 ? (
                    <div className="text-sm text-gray-500">No subtitles available</div>
                  ) : srtCues.map((c, i) => (
                    <div
                      key={i}
                      id={`cue-${i}`}
                      onClick={() => { if (videoRef.current) videoRef.current.currentTime = c.start; }}
                      className={`dialogue-card p-4 rounded-2xl transition-shadow duration-150 ${i === currentCueIndex ? 'ring-2 ring-blue-400 shadow-lg' : 'shadow-md'} bg-white dark:bg-gray-800 cursor-pointer`}
                      style={{ minWidth: 260 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-semibold text-sm text-gray-700 dark:text-gray-200">{i+1}</div>
                          <div className="text-xs text-gray-500">{new Date(c.start * 1000).toISOString().substr(11, 12)}  →  {new Date(c.end * 1000).toISOString().substr(11, 12)}</div>
                        </div>
                        <div>
                          <button onClick={(e) => { e.stopPropagation(); /* TODO: open edit dialog */ }} className="w-9 h-9 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center shadow-sm">
                            <Edit className="h-4 w-4 text-gray-500" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 text-lg text-gray-900 dark:text-white">{c.text}</div>
                    </div>
                  ))}
                </div>
```

### ✅ AFTER:
```tsx
                <div ref={cueListRef} className="dialogue-container">
                  {srtCues.length === 0 ? (
                    <div className="text-sm text-gray-500">No subtitles available</div>
                  ) : srtCues.map((c, i) => (
                    <motion.div
                      key={i}
                      id={`cue-${i}`}
                      onClick={() => { if (videoRef.current) videoRef.current.currentTime = c.start; }}
                      initial={{ x: 100, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                      whileHover={{ y: -2 }}
                      className={`dialogue-card p-4 rounded-2xl cursor-pointer transition-all duration-200 ${
                        i === currentCueIndex 
                          ? 'ring-2 ring-blue-500 shadow-lg scale-105 bg-blue-50 dark:bg-blue-900/30' 
                          : 'shadow-md bg-white dark:bg-gray-800 hover:shadow-lg'
                      }`}
                      style={{ minWidth: 260 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm transition-all ${
                            i === currentCueIndex
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                          }`}>
                            {i+1}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(c.start * 1000).toISOString().substr(11, 12)}  →  {new Date(c.end * 1000).toISOString().substr(11, 12)}</div>
                        </div>
                        <div>
                          <motion.button 
                            onClick={(e) => { e.stopPropagation(); /* TODO: open edit dialog */ }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="w-9 h-9 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                          >
                            <Edit className="h-4 w-4 text-gray-500" />
                          </motion.button>
                        </div>
                      </div>
                      <div className={`mt-3 text-lg ${i === currentCueIndex ? 'font-semibold text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'}`}>
                        {c.text}
                      </div>
                    </motion.div>
                  ))}
                </div>
```

### 📝 KEY CHANGES:

#### 1. **Slide-in Animation**
```tsx
<motion.div
  initial={{ x: 100, opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  transition={{ delay: i * 0.05, duration: 0.3 }}
  whileHover={{ y: -2 }}
>
```
- Slides in from right 100px
- Fades in simultaneously
- Staggered by 50ms per card
- Lifts 2px on hover

#### 2. **Active Card Styling**
```tsx
className={`dialogue-card p-4 rounded-2xl cursor-pointer transition-all duration-200 ${
  i === currentCueIndex 
    ? 'ring-2 ring-blue-500 shadow-lg scale-105 bg-blue-50 dark:bg-blue-900/30' 
    : 'shadow-md bg-white dark:bg-gray-800 hover:shadow-lg'
}`}
```
- Ring color: `ring-blue-500` (instead of `ring-blue-400`)
- Added `scale-105` (5% larger)
- Added background: `bg-blue-50 dark:bg-blue-900/30`

#### 3. **Number Badge Animation**
```tsx
<div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm transition-all ${
  i === currentCueIndex
    ? 'bg-blue-500 text-white'
    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
}`}>
```
- Turns blue when active
- Text becomes white

#### 4. **Edit Button Animation**
```tsx
<motion.button 
  onClick={(e) => { e.stopPropagation(); }}
  whileHover={{ scale: 1.1 }}
  whileTap={{ scale: 0.9 }}
  className="w-9 h-9 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
>
```
- `whileHover`: 10% larger
- `whileTap`: 10% smaller
- Added background color transitions

#### 5. **Text Color Changes**
```tsx
<div className={`mt-3 text-lg ${
  i === currentCueIndex 
    ? 'font-semibold text-blue-900 dark:text-blue-100' 
    : 'text-gray-900 dark:text-white'
}`}>
```
- Text becomes darker/blue when active
- Becomes semibold for emphasis

---

## SECTION 5: CSS Updates (globals.css)

### ❌ BEFORE:
```css
/* Horizontal dialogue carousel */
.dialogue-container {
  display: flex;
  flex-direction: row-reverse;
  gap: 16px;
  padding: 12px;
  overflow-x: auto;
  scroll-behavior: smooth;
  white-space: nowrap;
  scroll-snap-type: x mandatory;
}
.dialogue-card {
  min-width: 260px;
  flex-shrink: 0;
  scroll-snap-align: center;
  animation: slideInFromRight 400ms ease both;
}

@keyframes slideInFromRight {
  from { transform: translateX(20%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@media (max-width: 420px) {
  .dialogue-container { gap: 12px; padding: 8px; }
  .dialogue-card { min-width: 220px; }
}
```

### ✅ AFTER:
```css
/* Horizontal dialogue carousel */
.dialogue-container {
  display: flex;
  flex-direction: row-reverse;
  gap: 16px;
  padding: 12px;
  overflow-x: auto;
  scroll-behavior: smooth;
  white-space: nowrap;
  scroll-snap-type: x mandatory;
}

.dialogue-card {
  min-width: 260px;
  flex-shrink: 0;
  scroll-snap-align: center;
}

/* Smooth transitions for dialogue cards */
@media (max-width: 420px) {
  .dialogue-container { 
    gap: 12px; 
    padding: 8px; 
  }
  .dialogue-card { 
    min-width: 220px; 
  }
}

/* Enhanced gradient animations */
@keyframes gradientShift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

/* Smooth scale animations on hover */
@keyframes scaleIn {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
```

### 📝 CSS CHANGES:
- Removed `slideInFromRight` animation (now handled by framer-motion)
- Removed `animation` property from `.dialogue-card`
- Added `gradientShift` keyframe (for future gradient animations)
- Added `scaleIn` keyframe (for future scale animations)
- Improved comments
- Better organization

---

## Summary of All Changes

| Component | Type | Changes |
|-----------|------|---------|
| **Imports** | Code | Added `Download`, `motion` |
| **FAB Button** | UI/Animation | Gradient, glow, spring animation |
| **Project Cards** | UI | Thumbnails, badges, better styling |
| **Download Button** | UI | Outline blue, icon |
| **Delete Button** | Animation | Added motion, hover/tap effects |
| **Dialogue Cards** | Animation | Slide-in, scale, highlight |
| **Badge** | UI/Animation | Color change, smooth transition |
| **Edit Button** | Animation | Hover/tap effects |
| **CSS** | Styling | Removed old, added new animations |

All changes maintain backward compatibility and existing functionality!
