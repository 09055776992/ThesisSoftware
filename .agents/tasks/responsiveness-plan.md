# Responsiveness Audit & Fix — Implementation Plan

**Project:** SCHOLAR Frontend (React 18 + Vite + TypeScript + Tailwind CSS v4)  
**Worktree:** `e:\Thesis Software\FrontEnd`  
**Build command:** `npm run build` (inside FrontEnd directory)  
**Breakpoints targeted:** Mobile 320–480px · Tablet 481–768px · Laptop 769–1024px · Desktop 1025–1440px+

---

## Summary of Issues Found

The audit identified **three categories** of problems, ordered by dependency:

1. **Layouts (FEAT-001)** — All three authenticated layouts have a fixed `w-[280px]` sidebar that is always visible, completely blocking mobile content. Provider and Admin layouts use `ml-[280px]` on main content with no mobile override.
2. **User Pages (FEAT-002)** — Messages page has a hard 3-column grid chat layout with no mobile fallback. Several form grids use `grid-cols-2` with no responsive prefix. Padding is uniformly `p-8` with no mobile reduction.
3. **Provider & Admin Pages (FEAT-003)** — Tables are used without `overflow-x-auto` wrappers everywhere. Stats grids use `grid-cols-4` with no mobile collapse. Form grids use `grid-cols-2` without sm: variants.

---

## FEAT-001 — Layouts: Mobile Sidebar Drawers

**Files:** `dashboard-layout.tsx`, `provider-layout.tsx`, `admin-layout.tsx`

### dashboard-layout.tsx

| Issue | Current | Fix |
|-------|---------|-----|
| Sidebar always visible | `<aside className="w-[280px] shrink-0 ...">` | `<aside className="hidden lg:flex lg:w-[280px] shrink-0 ...">` |
| No mobile navigation | Top bar has no hamburger | Add `<Button className="lg:hidden mr-2" onClick={() => setSidebarOpen(true)}><Menu /></Button>` in top bar |
| No mobile drawer | Sheet imported but only used for notifications | Add `<Sheet open={sidebarOpen}>` with `<SheetContent side="left" className="w-[280px] p-0 overflow-y-auto">` containing sidebar content |

### provider-layout.tsx

| Issue | Current | Fix |
|-------|---------|-----|
| Sidebar always visible (fixed position) | `<aside className="w-[280px] ... fixed left-0 top-0 h-screen">` | `<aside className="hidden lg:flex flex-col w-[280px] ... sticky top-0 h-screen shrink-0">` |
| Main content fixed margin | `<main className="flex-1 ml-[280px]">` | `<main className="flex-1 min-w-0">` |
| No mobile top bar | None | Add `<div className="sticky top-0 z-30 bg-white border-b ... lg:hidden">` with Menu button |
| No mobile drawer | Sheet not imported | Import Sheet/SheetContent, add `sidebarOpen` state, add Sheet drawer |

### admin-layout.tsx

Same pattern as provider-layout.tsx — apply identical fixes.

---

## FEAT-002 — User Pages

### messages.tsx — CRITICAL

| Issue | Current | Fix |
|-------|---------|-----|
| Hard 3-col grid | `grid grid-cols-3 gap-4` | `grid grid-cols-1 md:grid-cols-3 gap-4` |
| No mobile single-pane | Both list+chat always shown | Add `showMobileChat` state; show list OR chat on mobile, both on md+ |
| Container padding | `p-8` | `p-4 md:p-8` |

### dashboard.tsx

| Issue | Current | Fix |
|-------|---------|-----|
| Post actions row | `flex items-center justify-between mt-3` | `flex flex-wrap items-center justify-between gap-2 mt-3` |
| Like/comment/share row | `flex items-center justify-around` | `flex flex-wrap items-center justify-around gap-1` |

### profile.tsx

| Issue | Current | Fix |
|-------|---------|-----|
| Education edit grids (×3) | `grid grid-cols-2 gap-4` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |
| Documents list overflow | Long filenames truncated | Wrap text in `<div className="min-w-0 flex-1">` |

### profile-setup.tsx

| Issue | Current | Fix |
|-------|---------|-----|
| Step 1 Location/DOB | `grid grid-cols-2 gap-4` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |
| Step 2 GPA/EducLevel | `grid grid-cols-2 gap-6` | `grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6` |
| Step 3 checkboxes | `grid grid-cols-2 gap-6` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |
| Step 3 financial | `grid grid-cols-2 gap-4` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |

### matches.tsx

| Issue | Current | Fix |
|-------|---------|-----|
| SHAP bar label | `w-[110px] shrink-0 truncate` | `min-w-0 shrink-0 max-w-[100px] truncate` |
| ShapBar container | `flex items-center gap-2 text-xs` | `flex flex-wrap items-center gap-2 text-xs` |

### saved.tsx

| Issue | Current | Fix |
|-------|---------|-----|
| Container padding | `p-8` | `p-4 md:p-8` |

### my-applications.tsx

| Issue | Current | Fix |
|-------|---------|-----|
| Application image | `md:size-48 shrink-0` | `h-48 md:h-auto md:w-48 shrink-0` |
| Modal info grid | `grid grid-cols-2 gap-4 text-sm` | `grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm` |

### settings.tsx

| Issue | Current | Fix |
|-------|---------|-----|
| Container padding | `p-8` | `p-4 md:p-8` |
| Security rows | `flex items-center justify-between py-3` | `flex flex-wrap items-center justify-between gap-2 py-3` |
| Dialogs | missing `max-h-[90vh] overflow-y-auto` | Add to all 3 Dialog DialogContent elements |

### landing.tsx

| Issue | Current | Fix |
|-------|---------|-----|
| Hero buttons | `flex gap-3` | `flex flex-wrap gap-3` |
| CTA padding | `p-10` | `p-6 md:p-10` |
| Modal padding | `p-8` | `p-6 md:p-8` |

---

## FEAT-003 — Provider & Admin Pages + Shared Components

### Provider Pages

#### provider-dashboard.tsx
| Issue | Current | Fix |
|-------|---------|-----|
| Container | `p-8 space-y-6` | `p-4 md:p-8 space-y-4 md:space-y-6` |
| Header | `flex items-center justify-between` | `flex flex-wrap items-center justify-between gap-4` |

#### provider/applications.tsx
| Issue | Current | Fix |
|-------|---------|-----|
| Container | `p-8 space-y-6` | `p-4 md:p-8 space-y-4 md:space-y-6` |
| Stats grid | `grid grid-cols-4 gap-4` | `grid grid-cols-2 lg:grid-cols-4 gap-4` |
| Table | No wrapper | `<div className="overflow-x-auto">` around `<Table>` |

#### provider/scholarships.tsx
| Issue | Current | Fix |
|-------|---------|-----|
| Container | `p-8 space-y-6` | `p-4 md:p-8 space-y-4 md:space-y-6` |
| Header | `flex items-center justify-between` | `flex flex-wrap items-center justify-between gap-4` |
| Table | No wrapper | `<div className="overflow-x-auto">` around `<Table>` |

#### provider/scholarship-create.tsx
| Issue | Current | Fix |
|-------|---------|-----|
| Container | `p-8 max-w-2xl` | `p-4 md:p-8 max-w-2xl` |
| Amount/MinGPA grid | `grid grid-cols-2 gap-4` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |
| Opening/Deadline grid | `grid grid-cols-2 gap-4` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |
| Type/Status grid | `grid grid-cols-2 gap-4` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |
| Field/Location grid | `grid grid-cols-2 gap-4` | `grid grid-cols-1 sm:grid-cols-2 gap-4` |
| Submit buttons | `flex gap-3 pt-2` | `flex flex-wrap gap-3 pt-2` |

#### provider/scholarship-edit.tsx
Same fixes as scholarship-create.tsx — read file first then apply.

#### provider/profile.tsx
| Issue | Current | Fix |
|-------|---------|-----|
| Container | `p-8 max-w-5xl mx-auto space-y-8` | `p-4 md:p-8 max-w-5xl mx-auto space-y-6 md:space-y-8` |
| Edit buttons | `flex gap-2` | `flex flex-wrap gap-2` |

#### provider/notifications.tsx
Read file first, apply `p-4 md:p-8` container and any grid/table fixes found.

### Admin Pages

#### admin/dashboard.tsx
| Issue | Current | Fix |
|-------|---------|-----|
| Container | `p-8 space-y-8` | `p-4 md:p-8 space-y-6 md:space-y-8` |

#### admin/applications.tsx
| Issue | Current | Fix |
|-------|---------|-----|
| Container (all 3 views) | `p-8 space-y-6` | `p-4 md:p-8 space-y-4 md:space-y-6` |
| Tables (3 instances) | No wrapper | `<div className="overflow-x-auto">` around each `<Table>` |
| Screening dialog grid | `grid grid-cols-2 gap-3` | `grid grid-cols-1 sm:grid-cols-2 gap-3` |
| Header flex | `flex items-center gap-4` | `flex flex-wrap items-center gap-4` |

#### admin/users.tsx
| Issue | Current | Fix |
|-------|---------|-----|
| Container | `p-8 space-y-6` | `p-4 md:p-8 space-y-4 md:space-y-6` |
| Table | No wrapper | `<div className="overflow-x-auto">` around `<Table>` |
| Modal buttons | `flex gap-3 pt-4` | `flex flex-wrap gap-3 pt-4` |

#### admin/providers.tsx
| Issue | Current | Fix |
|-------|---------|-----|
| Container | `p-8 space-y-6` | `p-4 md:p-8 space-y-4 md:space-y-6` |
| Stats grid | `grid grid-cols-4 gap-4` | `grid grid-cols-2 lg:grid-cols-4 gap-4` |
| Table | No wrapper | `<div className="overflow-x-auto">` around `<Table>` |

#### admin/scholarships.tsx
| Issue | Current | Fix |
|-------|---------|-----|
| Container | `p-8 space-y-6` | `p-4 md:p-8 space-y-4 md:space-y-6` |
| Header notice | `flex items-center justify-between` | `flex flex-wrap items-start justify-between gap-4` |
| Stats row | `grid grid-cols-3 gap-4` | `grid grid-cols-1 sm:grid-cols-3 gap-4` |
| Table | No wrapper | `<div className="overflow-x-auto">` around `<Table>` |

#### admin/reports.tsx
| Issue | Current | Fix |
|-------|---------|-----|
| Container | `p-8` | `p-4 md:p-8` |

#### admin/messages.tsx
| Issue | Current | Fix |
|-------|---------|-----|
| Container | `p-8` | `p-4 md:p-8` |
| Placeholder card | `p-12` | `p-6 md:p-12` |

#### admin/settings.tsx
| Issue | Current | Fix |
|-------|---------|-----|
| Container | `p-8 space-y-6` | `p-4 md:p-8 space-y-4 md:space-y-6` |
| TabsList overflow | 4 tabs can overflow on narrow screens | Add `className="flex-wrap h-auto"` to `<TabsList>` |

#### admin/notifications.tsx
Read file first, apply standard `p-4 md:p-8` and check for grid/table issues.

---

## Verification

After all three FEATs are applied, run:

```powershell
cd 'e:\Thesis Software\FrontEnd'
npm run build
```

Expected: exit code 0, no TypeScript or Vite errors.

---

## FEAT Artifact Locations

```
e:\Thesis Software\.agents\tasks\task-responsiveness-audit-fix\
├── task.json
├── context.json
└── features\
    ├── FEAT-001.json   (Layouts — mobile sidebars)
    ├── FEAT-002.json   (User Pages)
    └── FEAT-003.json   (Provider + Admin Pages + Components)
```
