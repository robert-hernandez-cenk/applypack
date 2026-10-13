/** @jsxImportSource hono/jsx */
import type { FC } from 'hono/jsx';
import { t } from '../i18n/t';
import { Icon, type IconName } from './icons';
import { languagePage } from './language';
import { THEMES, currentTheme, type Theme } from './theme';

/*
 * The appearance switch: System, Light or Dark, three buttons in one form, no
 * script. It posts to /settings/theme and comes back to the page it was
 * pressed on (the same way the language forms do). In the menu it is a row of
 * three icons on a wide screen and a column of them on the rail; each button
 * keeps its word as its name.
 */

const SWITCH_ACTION = '/settings/theme';

const ICON: Record<Theme, IconName> = { system: 'monitor', light: 'sun', dark: 'moon' };

const GROUP = {
  /** The foot of the menu: a row of icons, a column of them on the rail. */
  sidebar: 'flex w-full gap-1 rounded-md bg-surface-overlay p-1 md:flex-col lg:flex-row',
  /** A settings row: the three with their words, at their own width. */
  settings: 'inline-flex gap-1 rounded-md bg-surface-overlay p-1',
} as const;

const BUTTON = {
  sidebar: 'min-h-[30px] flex-1 justify-center px-2 py-1 text-meta md:px-0 lg:px-2',
  settings: 'min-h-[32px] gap-2 px-3 py-1 text-note',
} as const;

/** In the menu the icons stand alone and the words remain as each button's name (a screen reader still reads them). */
const WORD = { sidebar: 'sr-only', settings: '' } as const;

export const ThemeSwitch: FC<{ variant: keyof typeof GROUP }> = ({ variant }) => {
  const current = currentTheme();
  return (
    <form method="post" action={SWITCH_ACTION}>
      <input type="hidden" name="back" value={languagePage().back} />
      <div role="group" aria-label={t('theme.label')} class={GROUP[variant]}>
        {THEMES.map((theme) => {
          const label = t(`theme.${theme}`);
          return (
            <button
              type="submit"
              name="theme"
              value={theme}
              title={label}
              aria-label={label}
              aria-current={theme === current ? 'true' : undefined}
              class={`inline-flex cursor-pointer items-center rounded-md font-medium transition-colors duration-150 ${BUTTON[variant]} ${
                theme === current ? 'bg-surface-raised text-accent-strong shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Icon name={ICON[theme]} size={16} />
              <span class={WORD[variant]}>{label}</span>
            </button>
          );
        })}
      </div>
    </form>
  );
};
