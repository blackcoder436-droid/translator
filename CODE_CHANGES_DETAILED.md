# Code Changes - Detailed Line-by-Line

## File: backend/routes/upload.js

### Change 1: Add Export Logging (Lines 397-400)
**Location:** Inside the export endpoint, after project validation

**Added:**
```javascript
// Log: Confirm studio settings are present in project
console.log('Export initiated:', {
  projectId: project._id.toString(),
  hasStudioSettings: !!project.studioSettings,
  studioSettings: project.studioSettings
});
```

**Purpose:** Verify that studio settings are being loaded from database

---

### Change 2: Extract All Studio Settings (Lines 447-455)
**Location:** In the export processing, when reading project settings

**Original:**
```javascript
const studio = project.studioSettings || {};
const fontSize = studio.fontSize || 24;
const fontColor = studio.fontColor || '#FFFFFF';
const fontName = studio.fontName || 'Arial';
const italic = studio.fontItalic ? 1 : 0;
const bold = (studio.fontWeight === 'bold' || (studio.fontWeight && studio.fontWeight.toString().toLowerCase().includes('bold'))) ? 1 : 0;
const marginV = 10 + (studio.yAxis ? Math.abs(Math.round(studio.yAxis)) : 0);
```

**Changed To:**
```javascript
const studio = project.studioSettings || {};
const fontSize = studio.fontSize || 24;
const fontColor = studio.fontColor || '#FFFFFF';
const fontName = studio.fontName || 'Arial';
const italic = studio.fontItalic ? 1 : 0;
const bold = (studio.fontWeight === 'bold' || (studio.fontWeight && studio.fontWeight.toString().toLowerCase().includes('bold'))) ? 1 : 0;
const xAxis = studio.xAxis || 0;                         // ← NEW
const yAxis = studio.yAxis || 0;                         // ← NEW
const showBackground = studio.showBackground !== false;  // ← NEW
const marginV = 10 + (yAxis ? Math.abs(Math.round(yAxis)) : 0);
const marginL = Math.max(0, 10 + Math.round(xAxis));    // ← NEW
const marginR = Math.max(0, 10 - Math.round(xAxis));    // ← NEW
```

**Changes:**
- Line 1: Extract xAxis (horizontal offset)
- Line 2: Extract yAxis (vertical offset)
- Line 3: Extract showBackground (visibility toggle)
- Line 4: Changed to use yAxis variable
- Line 5: Calculate left margin from xAxis
- Line 6: Calculate right margin from xAxis

**Why:** Ensures all studio settings are available for both export methods

---

### Change 3: Improve Drawtext Filter (Lines 512-540)
**Location:** In the TTF font handling section

**Original:**
```javascript
const drawParts = [];
const fontPathForFfmpeg = fontFile.replace(/\\/g, '/');
const boxcolor = 'black@0.6';
const fontsize = fontSize;
const yPos = `h-${marginV}`;
// Re-parse SRT...
// (parsing code continues)
for (const en of eventsNum) {
  const txt = en.text.replace(/:/g, '\\:').replace(/,/g, '\\,');
  const part = `drawtext=fontfile='${fontPathForFfmpeg}':text='${txt}':fontsize=${fontsize}:fontcolor=${fontColor}:x=(w-text_w)/2:y=${yPos}:box=1:boxcolor=${boxcolor}:boxborderw=6:enable='between(t,${en.start},${en.end})'`;
  drawParts.push(part);
}
```

**Changed To:**
```javascript
const drawParts = [];
const fontPathForFfmpeg = fontFile.replace(/\\/g, '/');
const boxcolor = showBackground ? 'black@0.6' : 'black@0';  // ← CHANGED
const fontsize = fontSize;
// Position: center horizontally with X-axis offset, positioned from bottom with Y-axis offset
const xPos = xAxis >= 0 ? `(w-text_w)/2+${xAxis}` : `(w-text_w)/2${xAxis}`;  // ← NEW
const yPos = `h-${marginV}`;
// Re-parse SRT...
// (parsing code continues)
for (const en of eventsNum) {
  const txt = en.text.replace(/:/g, '\\:').replace(/,/g, '\\,');
  const fontweightStr = bold ? ':fontweight=bold' : '';                    // ← NEW
  const fontangleStr = italic ? ':fontangle=15' : '';                      // ← NEW
  const part = `drawtext=fontfile='${fontPathForFfmpeg}':text='${txt}':fontsize=${fontsize}:fontcolor=${fontColor}:x=${xPos}:y=${yPos}:box=${showBackground ? 1 : 0}:boxcolor=${boxcolor}:boxborderw=${showBackground ? 6 : 0}${fontweightStr}${fontangleStr}:enable='between(t,${en.start},${en.end})'`;
  drawParts.push(part);
}
```

**Changes:**
- Line 1: boxcolor now respects showBackground
- Line 2: New xPos variable with xAxis offset
- Lines 3-4: New fontweightStr and fontangleStr variables
- Line 5: Updated drawtext filter with:
  - Dynamic xPos instead of hardcoded center
  - Dynamic box visibility
  - Dynamic boxcolor
  - Dynamic boxborderw
  - Added fontweightStr and fontangleStr

**Why:** Applies all studio settings to FFmpeg drawtext filter

---

### Change 4: Enhance ASS File Style Line (Lines 595-598)
**Location:** In the ASS file generation section

**Original:**
```javascript
const outline = studio.outlineWidth || 1;
const shadow = studio.shadow || 0;
assLines.push(`Style: Default,${assFontName},${fontSize},${hexToAssColor(fontColor)},&H000000FF,&H00000000,&H00000000,${bold},${italic},0,0,100,100,0,0,1,${outline},${shadow},2,10,10,${marginV},1`);
```

**Changed To:**
```javascript
const outline = studio.outlineWidth || 1;
const shadow = studio.shadow || 0;
// Create color with optional background based on showBackground setting
const backColor = showBackground ? '&H000000AA' : '&H00000000'; // Semi-transparent black if background shown
assLines.push(`Style: Default,${assFontName},${fontSize},${hexToAssColor(fontColor)},&H000000FF,&H00000000,${backColor},${bold},${italic},0,0,100,100,0,0,1,${outline},${shadow},2,${marginL},${marginR},${marginV},1`);
```

**Changes:**
- Line 1: New backColor variable
- Line 2: Changed hardcoded `10,10,${marginV},1` to `${marginL},${marginR},${marginV},1`
- Updated assLines.push to use:
  - `${backColor}` instead of hardcoded `&H00000000`
  - `${marginL}` instead of hardcoded `10`
  - `${marginR}` instead of hardcoded `10`

**Why:** Applies X-axis offset and background visibility to ASS file

---

### Change 5: Add Verification Logging (Lines 606-612)
**Location:** After ASS file is written, before ffmpeg execution

**Added:**
```javascript
// Log studio settings being used for debugging
console.log('Export: Applied studio settings', {
  fontSize, fontColor, fontName: assFontName, bold, italic,
  xAxis, yAxis, marginL, marginR, marginV,
  showBackground, backColor, outline, shadow
});
```

**Purpose:** Log all applied settings for verification and debugging

---

## Summary of Changes

### Total Lines Modified: ~30
### Total Lines Added: ~12
### Total Lines Removed: 0
### Breaking Changes: None
### Database Changes: None
### API Changes: None

### Variables Added:
- `xAxis` - Horizontal offset
- `yAxis` - Vertical offset (renamed variable)
- `showBackground` - Background visibility toggle
- `marginL` - Left margin (calculated)
- `marginR` - Right margin (calculated)
- `xPos` - Drawtext X position expression
- `fontweightStr` - Bold formatting string
- `fontangleStr` - Italic formatting string
- `boxcolor` - Dynamic box color (updated)
- `backColor` - ASS background color

### Statements Modified:
1. boxcolor initialization (added ternary)
2. marginV calculation (changed to use yAxis variable)
3. Drawtext filter generation (added 4 parameters)
4. ASS style line (changed 3 margin values)
5. Exports endpoint call parameters (changed 1 parameter)

### Key Logic Changes:
1. **Margin Calculation**: From hardcoded to dynamic
2. **Background Visibility**: From ignored to applied
3. **Position Handling**: From Y-axis only to X+Y-axis
4. **Font Styling**: From style attributes to filter parameters

## Verification Steps

To verify all changes are in place:

1. Check line 397 for export logging
2. Check lines 450-455 for new variables
3. Check lines 519-529 for updated drawtext parameters
4. Check line 598 for dynamic background color
5. Check line 599 for dynamic margins in ASS style
6. Check lines 607-612 for verification logging

All these lines should contain the changes described above.

