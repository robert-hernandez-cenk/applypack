/** @jsxImportSource hono/jsx */
import type { FC, PropsWithChildren } from 'hono/jsx';

/** Radio-headed option card — the job-source pickers share it. */
export const ModeCard: FC<
  PropsWithChildren<{
    value: string;
    label: string;
    checked?: boolean;
    disabled?: boolean;
    name?: string;
  }>
> = ({ value, label, checked = false, disabled = false, name = 'resumeMode', children }) => (
  <fieldset
    data-ui="mode-card"
    data-mode={value}
    // min-w-0: a fieldset's default min-inline-size is min-content, which let a
    // long option or a file input push the page sideways at 375 px.
    class={`min-w-0 rounded-md border border-line bg-surface-raised p-3 transition-colors duration-150 has-[:checked]:border-accent/50 has-[:checked]:bg-surface-selected ${
      disabled ? 'opacity-60' : ''
    }`}
  >
    <label class="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        class="h-4 w-4 accent-accent"
      />
      {label}
    </label>
    {/* A disabled mode can never be chosen, so what it holds is its one-line reason: always in sight. */}
    <div data-ui={disabled ? undefined : 'mode-body'} class="mt-2.5">
      {children}
    </div>
  </fieldset>
);
