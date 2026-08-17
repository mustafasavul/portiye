import { useT } from "../i18n";
import { GearIcon } from "../icons";

/**
 * The way out of a panel you did not want. Every panel that can be switched
 * off carries one, so "how do I hide this?" is answered where the question is
 * asked rather than in a menu you have to go looking for.
 */
export function SettingsButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      className="btn btn--icon panel__gear"
      onClick={onClick}
      aria-label={t("settings.open")}
      title={t("settings.open")}
    >
      <GearIcon />
    </button>
  );
}
