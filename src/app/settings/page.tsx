"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiError, Category, CategoryColor, IgnorePattern, Productivity, Rule, Settings } from "@/types";
import { CATEGORY_COLORS, PRODUCTIVITY_LEVELS } from "@/types";
import { apiFetch, toApiError, useApi } from "@/hooks/useApi";
import { Widget } from "@/components/ui/Widget";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { Empty, ErrorPanel, Loading } from "@/components/ui/States";
import { colorHex, PALETTE } from "@/lib/palette";
import { matchesUrl } from "@/lib/glob";
import { parseHoursMinutes, toHoursMinutes } from "@/lib/time";

type Tab = "CATEGORIES" | "SITE RULES" | "IGNORED SITES" | "PREFERENCES" | "YOUR DATA";
const TABS: Tab[] = ["CATEGORIES", "SITE RULES", "IGNORED SITES", "PREFERENCES", "YOUR DATA"];
const SYSTEM = ["IDLE", "OTHER"];

const input =
  "border border-outline-variant bg-surface-container-lowest px-sm py-xs text-label text-on-background placeholder:text-outline-variant focus:border-secondary-fixed focus:outline-none";
const ghostButton =
  "border border-outline-variant px-sm py-xs text-ui-small text-outline hover:border-secondary-fixed hover:text-secondary-fixed disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-outline-variant disabled:hover:text-outline";
const dangerButton =
  "border border-outline-variant px-sm py-xs text-ui-small text-outline hover:border-error hover:text-error disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-outline-variant disabled:hover:text-outline";
const primaryButton =
  "border border-primary-container bg-primary-container px-md py-xs text-label text-white hover:brightness-110 disabled:opacity-40";

function useMutation() {
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>, after?: () => void): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      after?.();
      return true;
    } catch (err) {
      setError(toApiError(err));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, run, clear: () => setError(null) };
}

function InlineError({ error }: { error: ApiError | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="mt-sm text-ui-small text-error">
      &gt; ERR: {error.message.toUpperCase()}
    </div>
  );
}

function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

function ColorPicker({ value, onChange, label }: { value: CategoryColor; onChange: (color: CategoryColor) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-[3px]" role="radiogroup" aria-label={label}>
      {CATEGORY_COLORS.map((color) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          title={color.toUpperCase()}
          key={color}
          onClick={() => onChange(color)}
          className={`h-5 w-5 border-2 ${value === color ? "border-on-background" : "border-transparent hover:border-outline"}`}
          style={{ backgroundColor: PALETTE[color] }}
        />
      ))}
    </div>
  );
}

// ─── Categories ─────────────────────────────────────────────────────

const PRODUCTIVITY_LABEL: Record<Productivity, string> = {
  PRODUCTIVE: "Productive",
  NEUTRAL: "Neutral",
  DISTRACTING: "Distracting"
};
const PRODUCTIVITY_COLOR: Record<Productivity, string> = { PRODUCTIVE: "#15ffd1", NEUTRAL: "#958da1", DISTRACTING: "#ff6b8a" };

/** Daily limit in minutes; empty = no limit. Saved when the field loses focus. */
function LimitField({ category, onSave }: { category: Category; onSave: (seconds: number | null) => void }) {
  const initial = category.dailyLimitSeconds ? String(Math.round(category.dailyLimitSeconds / 60)) : "";
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  const commit = () => {
    const minutes = Number(value);
    const next = value.trim() === "" || minutes <= 0 ? null : Math.min(1440, Math.max(1, Math.round(minutes))) * 60;
    if (next !== category.dailyLimitSeconds) onSave(next);
    else setValue(initial);
  };
  return (
    <label className="flex items-center gap-xs font-read text-read-sm text-outline">
      Limit
      <input
        className={`${input} w-16 text-center`}
        inputMode="numeric"
        value={value}
        placeholder="none"
        aria-label={`Daily limit for ${category.name}, in minutes`}
        onChange={(event) => setValue(event.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
      />
      min/day
    </label>
  );
}

function CategoriesTab({ categories, reload }: { categories: Category[]; reload: () => void }) {
  const mutation = useMutation();
  const [name, setName] = useState("");
  const [color, setColor] = useState<CategoryColor>("cyan");
  const [productivity, setProductivity] = useState<Productivity>("NEUTRAL");
  const [editing, setEditing] = useState<{ id: string; name: string; color: CategoryColor } | null>(null);

  const save = (id: string, data: Record<string, unknown>) =>
    void mutation.run(() => apiFetch("/api/categories", { method: "PUT", body: JSON.stringify({ id, ...data }) }), reload);

  const reorder = (index: number, delta: number) => {
    const next = move(categories, index, delta);
    if (next === categories) return;
    void mutation.run(() => apiFetch("/api/categories", { method: "PATCH", body: JSON.stringify({ orderedIds: next.map((c) => c.id) }) }), reload);
  };

  return (
    <div className="grid grid-cols-1 gap-widget-gutter xl:grid-cols-[2fr_1fr]">
      <Widget
        title="CATEGORIES"
        hint="Each website you visit lands in a category. Mark categories as productive or distracting to get your productivity score, and set a daily limit to get a warning."
        meta={`${categories.length} CATEGORIES`}
      >
        <ul>
          {categories.map((category, index) => {
            const isEditing = editing?.id === category.id;
            const isSystem = SYSTEM.includes(category.name);
            const isIdle = category.name === "IDLE";
            return (
              <li key={category.id} className="border-b border-outline-variant py-sm last:border-0">
                <div className="flex flex-wrap items-center gap-sm">
                  <div className="flex flex-col">
                    <button type="button" className="px-xs text-ui-small text-outline hover:text-secondary-fixed disabled:opacity-20" disabled={index === 0 || mutation.busy} onClick={() => reorder(index, -1)} aria-label={`Move ${category.name} up`}>
                      ^
                    </button>
                    <button type="button" className="px-xs text-ui-small text-outline hover:text-secondary-fixed disabled:opacity-20" disabled={index === categories.length - 1 || mutation.busy} onClick={() => reorder(index, 1)} aria-label={`Move ${category.name} down`}>
                      v
                    </button>
                  </div>
                  {isEditing ? (
                    <form
                      className="flex flex-1 flex-wrap items-center gap-sm"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void mutation.run(
                          () =>
                            apiFetch("/api/categories", {
                              method: "PUT",
                              body: JSON.stringify({ id: category.id, name: isSystem ? undefined : editing.name, color: editing.color })
                            }),
                          () => {
                            setEditing(null);
                            reload();
                          }
                        );
                      }}
                    >
                      <input
                        className={`${input} w-40`}
                        value={editing.name}
                        disabled={isSystem}
                        maxLength={32}
                        aria-label="Category name"
                        onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                        autoFocus
                      />
                      <ColorPicker value={editing.color} onChange={(value) => setEditing({ ...editing, color: value })} label="Category color" />
                      <button type="submit" className={primaryButton} disabled={mutation.busy}>
                        SAVE
                      </button>
                      <button type="button" className={ghostButton} onClick={() => setEditing(null)}>
                        CANCEL
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="min-w-[130px] flex-1">
                        <CategoryBadge category={category} />
                        {isIdle ? <p className="font-read text-read-sm text-outline">Time away from the keyboard. Never counted.</p> : null}
                      </div>
                      {!isIdle ? (
                        <>
                          <select
                            className={`${input} font-read text-read-sm`}
                            value={category.productivity}
                            aria-label={`Type of ${category.name}`}
                            style={{ color: PRODUCTIVITY_COLOR[category.productivity] }}
                            onChange={(event) => save(category.id, { productivity: event.target.value })}
                          >
                            {PRODUCTIVITY_LEVELS.map((level) => (
                              <option key={level} value={level} style={{ color: PRODUCTIVITY_COLOR[level] }}>
                                {PRODUCTIVITY_LABEL[level]}
                              </option>
                            ))}
                          </select>
                          <LimitField category={category} onSave={(seconds) => save(category.id, { dailyLimitSeconds: seconds })} />
                        </>
                      ) : null}
                      <button
                        type="button"
                        className={ghostButton}
                        onClick={() => {
                          mutation.clear();
                          setEditing({ id: category.id, name: category.name, color: category.color });
                        }}
                      >
                        EDIT
                      </button>
                      <button
                        type="button"
                        className={dangerButton}
                        disabled={category.isDefault || mutation.busy}
                        title={category.isDefault ? "Built-in categories cannot be deleted" : undefined}
                        onClick={() => {
                          if (!window.confirm(`Delete ${category.name}? Its time moves to OTHER and its site rules are removed.`)) return;
                          void mutation.run(() => apiFetch("/api/categories", { method: "DELETE", body: JSON.stringify({ id: category.id }) }), reload);
                        }}
                      >
                        DELETE
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <InlineError error={mutation.error} />
      </Widget>

      <Widget title="NEW CATEGORY" hint="Create a category, then add site rules for it in the SITE RULES tab.">
        <form
          className="space-y-md"
          onSubmit={(event) => {
            event.preventDefault();
            void mutation.run(() => apiFetch("/api/categories", { method: "POST", body: JSON.stringify({ name, color, productivity }) }), () => {
              setName("");
              reload();
            });
          }}
        >
          <label className="block">
            <span className="mb-xs block text-ui-small text-outline">NAME</span>
            <input className={`${input} w-full`} value={name} onChange={(event) => setName(event.target.value)} placeholder="LEARNING" maxLength={32} required />
          </label>
          <div>
            <span className="mb-xs block text-ui-small text-outline">COLOR</span>
            <ColorPicker value={color} onChange={setColor} label="New category color" />
          </div>
          <label className="block">
            <span className="mb-xs block text-ui-small text-outline">TYPE</span>
            <select className={`${input} w-full font-read text-read-sm`} value={productivity} onChange={(event) => setProductivity(event.target.value as Productivity)}>
              {PRODUCTIVITY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {PRODUCTIVITY_LABEL[level]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center justify-between gap-sm">
            {name.trim() ? <CategoryBadge category={{ name: name.trim().toUpperCase().replace(/\s+/g, "_"), color }} size="ui-small" /> : <span />}
            <button type="submit" className={primaryButton} disabled={mutation.busy || !name.trim()}>
              + ADD
            </button>
          </div>
        </form>
      </Widget>
    </div>
  );
}

// ─── Rules ──────────────────────────────────────────────────────────

function RuleTester({ rules, categories, ignore }: { rules: Rule[]; categories: Category[]; ignore: IgnorePattern[] }) {
  const [url, setUrl] = useState("");
  const result = useMemo(() => {
    const value = url.trim();
    if (!value) return null;
    const normalized = /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`;
    const ignored = ignore.find((item) => matchesUrl(normalized, item.pattern));
    if (ignored) return { kind: "ignored" as const, pattern: ignored.pattern };
    const rule = rules.find((item) => matchesUrl(normalized, item.pattern));
    const category = rule ? categories.find((item) => item.id === rule.categoryId) : categories.find((item) => item.name === "OTHER");
    return { kind: "match" as const, rule, category };
  }, [url, rules, categories, ignore]);

  return (
    <div className="mb-md border border-outline-variant bg-surface-container-lowest p-md">
      <label htmlFor="rule-tester" className="mb-sm block text-label text-secondary-fixed">
        TRY A WEBSITE
      </label>
      <input id="rule-tester" className={`${input} w-full`} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://github.com/vercel/next.js" />
      <div className="mt-sm min-h-[24px] font-read text-read" aria-live="polite">
        {!result ? (
          <span className="text-outline">&gt; Type an address to see which category it goes to.</span>
        ) : result.kind === "ignored" ? (
          <span className="text-tertiary">&gt; Ignored (matches &quot;{result.pattern}&quot;): this site is never recorded.</span>
        ) : (
          <span className="flex flex-wrap items-center gap-sm text-outline">
            &gt; {result.rule ? `Rule #${rules.indexOf(result.rule) + 1} "${result.rule.pattern}" sends it to` : "No rule matches, so it goes to"}
            {result.category ? <CategoryBadge category={result.category} size="ui-small" /> : null}
          </span>
        )}
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  index,
  total,
  categories,
  busy,
  onSave,
  onMove,
  onDelete
}: {
  rule: Rule;
  index: number;
  total: number;
  categories: Category[];
  busy: boolean;
  onSave: (data: { pattern?: string; categoryId?: string }) => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
}) {
  const [pattern, setPattern] = useState(rule.pattern);
  useEffect(() => setPattern(rule.pattern), [rule.pattern]);
  const commit = () => {
    const trimmed = pattern.trim();
    if (trimmed && trimmed !== rule.pattern) onSave({ pattern: trimmed });
    else setPattern(rule.pattern);
  };

  return (
    <li className="grid grid-cols-[28px_1fr] items-center gap-sm border-b border-outline-variant py-sm last:border-0 sm:grid-cols-[28px_1fr_160px_auto]">
      <div className="flex flex-col items-center">
        <button type="button" className="text-ui-small text-outline hover:text-secondary-fixed disabled:opacity-20" disabled={index === 0 || busy} onClick={() => onMove(-1)} aria-label={`Move rule ${rule.pattern} up`}>
          ^
        </button>
        <span className="text-ui-small text-outline-variant">{index + 1}</span>
        <button type="button" className="text-ui-small text-outline hover:text-secondary-fixed disabled:opacity-20" disabled={index === total - 1 || busy} onClick={() => onMove(1)} aria-label={`Move rule ${rule.pattern} down`}>
          v
        </button>
      </div>
      <input
        className={`${input} w-full`}
        value={pattern}
        aria-label="Rule pattern"
        onChange={(event) => setPattern(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
          if (event.key === "Escape") setPattern(rule.pattern);
        }}
      />
      <select
        className={`${input} col-start-2 sm:col-start-auto`}
        value={rule.categoryId}
        aria-label="Rule category"
        onChange={(event) => onSave({ categoryId: event.target.value })}
        style={{ color: colorHex(categories.find((c) => c.id === rule.categoryId)?.color) }}
      >
        {categories
          .filter((category) => category.name !== "IDLE")
          .map((category) => (
            <option key={category.id} value={category.id} style={{ color: colorHex(category.color) }}>
              {category.name}
            </option>
          ))}
      </select>
      <button type="button" className={`${dangerButton} col-start-2 justify-self-start sm:col-start-auto`} disabled={busy} onClick={onDelete}>
        DELETE
      </button>
    </li>
  );
}

function RulesTab({ rules, categories, ignore, reload }: { rules: Rule[]; categories: Category[]; ignore: IgnorePattern[]; reload: () => void }) {
  const mutation = useMutation();
  const assignable = categories.filter((category) => category.name !== "IDLE");
  const [pattern, setPattern] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const selectedCategory = categoryId || assignable[0]?.id || "";

  const reorder = (index: number, delta: number) => {
    const next = move(rules, index, delta);
    if (next === rules) return;
    void mutation.run(() => apiFetch("/api/rules", { method: "PATCH", body: JSON.stringify({ orderedIds: next.map((r) => r.id) }) }), reload);
  };

  return (
    <Widget
      title="SITE RULES"
      hint="Which category each website goes to. Rules are checked from top to bottom and the first match wins. Sites with no rule go to OTHER."
      meta={`${rules.length} RULES`}
    >
      <p className="mb-md font-read text-read-sm text-outline">
        Use * as a wildcard: <span className="text-on-surface-variant">*.github.com</span> (GitHub and its subdomains),{" "}
        <span className="text-on-surface-variant">localhost:*</span> (any local port), <span className="text-on-surface-variant">*notion.so*</span> (anything containing notion.so).
      </p>
      <RuleTester rules={rules} categories={categories} ignore={ignore} />
      {rules.length === 0 ? (
        <Empty>NO RULES YET. EVERYTHING IS CATEGORIZED AS OTHER.</Empty>
      ) : (
        <ul>
          {rules.map((rule, index) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              index={index}
              total={rules.length}
              categories={categories}
              busy={mutation.busy}
              onMove={(delta) => reorder(index, delta)}
              onSave={(data) => void mutation.run(() => apiFetch("/api/rules", { method: "PUT", body: JSON.stringify({ id: rule.id, ...data }) }), reload)}
              onDelete={() => void mutation.run(() => apiFetch("/api/rules", { method: "DELETE", body: JSON.stringify({ id: rule.id }) }), reload)}
            />
          ))}
        </ul>
      )}

      <form
        className="mt-md grid grid-cols-1 gap-sm border border-dashed border-primary-container p-sm sm:grid-cols-[1fr_160px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          void mutation.run(() => apiFetch("/api/rules", { method: "POST", body: JSON.stringify({ pattern, categoryId: selectedCategory }) }), () => {
            setPattern("");
            reload();
          });
        }}
      >
        <input className={input} value={pattern} onChange={(event) => setPattern(event.target.value)} placeholder="*.udemy.com" aria-label="New rule pattern" required />
        <select className={input} value={selectedCategory} onChange={(event) => setCategoryId(event.target.value)} aria-label="New rule category">
          {assignable.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <button type="submit" className={primaryButton} disabled={mutation.busy || !pattern.trim() || !selectedCategory}>
          + ADD RULE
        </button>
      </form>
      <InlineError error={mutation.error} />
    </Widget>
  );
}

// ─── Ignore list ────────────────────────────────────────────────────

function IgnoreTab({ patterns, reload }: { patterns: IgnorePattern[]; reload: () => void }) {
  const mutation = useMutation();
  const [pattern, setPattern] = useState("");

  return (
    <Widget
      title="IGNORED SITES"
      hint="Websites that are never recorded, for example your bank or private sites. Same * wildcard as site rules."
      meta={`${patterns.length} SITES`}
    >
      {patterns.length === 0 ? (
        <Empty>THE IGNORE LIST IS EMPTY.</Empty>
      ) : (
        <ul className="space-y-xs">
          {patterns.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-sm border border-outline-variant px-sm py-xs">
              <span className="truncate text-label text-on-surface-variant">{item.pattern}</span>
              <button
                type="button"
                className={dangerButton}
                disabled={mutation.busy}
                aria-label={`Remove ${item.pattern}`}
                onClick={() => void mutation.run(() => apiFetch("/api/ignore-patterns", { method: "DELETE", body: JSON.stringify({ id: item.id }) }), reload)}
              >
                REMOVE
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-md flex gap-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void mutation.run(() => apiFetch("/api/ignore-patterns", { method: "POST", body: JSON.stringify({ pattern }) }), () => {
            setPattern("");
            reload();
          });
        }}
      >
        <input className={`${input} flex-1`} value={pattern} onChange={(event) => setPattern(event.target.value)} placeholder="*.bank.com" aria-label="New ignore pattern" required />
        <button type="submit" className={primaryButton} disabled={mutation.busy || !pattern.trim()}>
          + APPEND
        </button>
      </form>
      <InlineError error={mutation.error} />
    </Widget>
  );
}

// ─── Preferences ────────────────────────────────────────────────────

function PreferencesTab({ settings }: { settings: Settings }) {
  const [goal, setGoal] = useState(toHoursMinutes(settings.dailyGoalSeconds));
  const [delayMinutes, setDelayMinutes] = useState(Math.round(settings.inactivityDelaySeconds / 60));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const timer = useRef<number | null>(null);
  const goalSeconds = parseHoursMinutes(goal);

  // Auto-save, debounced 500ms.
  const schedule = (data: Partial<Pick<Settings, "dailyGoalSeconds" | "inactivityDelaySeconds">>) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setStatus("saving");
    timer.current = window.setTimeout(() => {
      apiFetch<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(data) })
        .then(() => {
          setStatus("saved");
          setError(null);
        })
        .catch((err: unknown) => {
          setStatus("error");
          setError(toApiError(err));
        });
    }, 500);
  };

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-widget-gutter xl:grid-cols-2">
      <Widget
        title="PREFERENCES"
        hint="Changes are saved automatically."
        meta={
          <span aria-live="polite" className={status === "error" ? "text-error" : status === "saved" ? "text-secondary-fixed" : ""}>
            {status === "saving" ? "SAVING..." : status === "saved" ? "SAVED" : status === "error" ? "SAVE FAILED" : "AUTO-SAVE"}
          </span>
        }
      >
        <div className="space-y-lg">
          <label className="block">
            <span className="mb-sm block text-label text-secondary-fixed">PRODUCTIVE GOAL</span>
            <input
              className={`${input} w-28 text-center ${goalSeconds === null || goalSeconds < 60 ? "border-error" : ""}`}
              value={goal}
              inputMode="numeric"
              placeholder="04:00"
              aria-describedby="goal-help"
              onChange={(event) => {
                setGoal(event.target.value);
                const seconds = parseHoursMinutes(event.target.value);
                if (seconds !== null && seconds >= 60) schedule({ dailyGoalSeconds: seconds });
              }}
            />
            <span id="goal-help" className="mt-xs block font-read text-read-sm text-outline">
              How much productive time you aim for each day (hours:minutes). Only categories marked Productive count. You can also change it from the TODAY screen.
            </span>
          </label>

          <label className="block">
            <span className="mb-sm flex justify-between text-label text-secondary-fixed">
              AWAY AFTER <span className="text-primary">{delayMinutes} MIN</span>
            </span>
            <input
              className="w-full"
              type="range"
              min={1}
              max={30}
              value={delayMinutes}
              onChange={(event) => {
                const minutes = Number(event.target.value);
                setDelayMinutes(minutes);
                schedule({ inactivityDelaySeconds: minutes * 60 });
              }}
            />
            <span className="mt-xs block font-read text-read-sm text-outline">
              After {delayMinutes} minutes without touching the mouse or keyboard, you are marked as away and that time stops counting.
            </span>
          </label>
          {error ? <ErrorPanel error={error} /> : null}
        </div>
      </Widget>

      <Widget title="CHROME EXTENSION" hint="The extension is what records your activity. It finds this app on its own.">
        <ol className="list-inside list-decimal space-y-xs font-read text-read text-on-surface-variant">
          <li>Open chrome://extensions</li>
          <li>Turn on Developer mode (top right)</li>
          <li>Click &quot;Load unpacked&quot; and pick the /extension folder</li>
          <li>Pin CHRONO.EXE: its icon shows your time today and the popup has play, pause and stop</li>
        </ol>
        <p className="mt-md font-read text-read-sm text-outline">
          Every 30 seconds it sends the address of your active tab and whether you are at the keyboard. Everything stays on your computer.
        </p>
      </Widget>
    </div>
  );
}

// ─── Your data ──────────────────────────────────────────────────────

function DataTab({ onRestored }: { onRestored: () => void }) {
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const restore = async (file: File) => {
    if (!window.confirm(`Restore ${file.name}? Everything currently stored will be replaced by this backup.`)) return;
    setBusy(true);
    try {
      const body = await file.text();
      const result = await apiFetch<{ sessions: number }>("/api/data", { method: "POST", body });
      setMessage({ tone: "ok", text: `Backup restored: ${result.sessions} activities.` });
      onRestored();
    } catch (err) {
      setMessage({ tone: "error", text: `Restore failed: ${toApiError(err).message}` });
    } finally {
      setBusy(false);
    }
  };

  const erase = async () => {
    if (!window.confirm("Delete your whole tracking history? Categories, rules and settings are kept. This cannot be undone.")) return;
    if (window.prompt('Type DELETE HISTORY to confirm') !== "DELETE HISTORY") return;
    setBusy(true);
    try {
      const result = await apiFetch<{ sessions: number }>("/api/data", { method: "DELETE", body: JSON.stringify({ confirm: "DELETE HISTORY" }) });
      setMessage({ tone: "ok", text: `History deleted (${result.sessions} activities).` });
    } catch (err) {
      setMessage({ tone: "error", text: `Delete failed: ${toApiError(err).message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-widget-gutter xl:grid-cols-3">
      <Widget title="EXPORT" hint="Download everything (history, categories, rules, settings) as one JSON file. Keep it as a backup.">
        <a href="/api/data" download className={`${primaryButton} inline-block`}>
          DOWNLOAD BACKUP
        </a>
      </Widget>
      <Widget title="RESTORE" hint="Load a backup file. It replaces everything currently stored.">
        <label className={`${ghostButton} inline-block cursor-pointer`}>
          CHOOSE A BACKUP FILE
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void restore(file);
            }}
          />
        </label>
      </Widget>
      <Widget title="DELETE HISTORY" hint="Erase all recorded activity. Categories, site rules and settings stay as they are.">
        <button type="button" className={dangerButton} disabled={busy} onClick={() => void erase()}>
          DELETE ALL HISTORY
        </button>
      </Widget>
      {message ? (
        <p role="status" className={`font-read text-read xl:col-span-3 ${message.tone === "ok" ? "text-secondary-fixed" : "text-error"}`}>
          &gt; {message.text}
        </p>
      ) : null}
      <p className="font-read text-read-sm text-outline xl:col-span-3">
        Everything is stored in a single file on your computer (prisma/chrono.db). Page addresses are kept without their query strings, and page titles are never stored.
      </p>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("CATEGORIES");
  const categories = useApi<Category[]>("/api/categories");
  const rules = useApi<Rule[]>("/api/rules");
  const ignore = useApi<IgnorePattern[]>("/api/ignore-patterns");
  const settings = useApi<Settings>("/api/settings");

  const error = categories.error ?? rules.error ?? ignore.error ?? settings.error;
  const ready = categories.data && rules.data && ignore.data && settings.data;
  const reloadAll = () => {
    categories.reload();
    rules.reload();
    ignore.reload();
    settings.reload();
  };

  return (
    <div className="grid gap-widget-gutter">
      <div className="flex flex-wrap gap-[1px]" role="tablist" aria-label="Settings sections">
        {TABS.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === item}
            key={item}
            className={`border border-primary-container px-md py-sm text-label ${
              tab === item ? "bg-primary-container text-white" : "text-outline hover:bg-surface-container-highest"
            }`}
            onClick={() => setTab(item)}
          >
            {tab === item ? item : `[${item}]`}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorPanel error={error} onRetry={reloadAll} />
      ) : !ready ? (
        <Loading />
      ) : (
        <>
          {tab === "CATEGORIES" ? (
            <CategoriesTab
              categories={categories.data!}
              reload={() => {
                categories.reload();
                rules.reload();
              }}
            />
          ) : null}
          {tab === "SITE RULES" ? <RulesTab rules={rules.data!} categories={categories.data!} ignore={ignore.data!} reload={rules.reload} /> : null}
          {tab === "IGNORED SITES" ? <IgnoreTab patterns={ignore.data!} reload={ignore.reload} /> : null}
          {tab === "YOUR DATA" ? <DataTab onRestored={reloadAll} /> : null}
          {tab === "PREFERENCES" ? <PreferencesTab settings={settings.data!} /> : null}
        </>
      )}
    </div>
  );
}
