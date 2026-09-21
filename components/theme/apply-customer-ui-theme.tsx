import {
  customerUiCssText,
  type CustomerUiTheme,
} from "@/lib/branch/customer-ui-theme";

/**
 * Thème interface client sans flash :
 * - rendu SSR (pas de useEffect / pas de mutation post-hydratation)
 * - sélecteurs assez spécifiques pour gagner sur `:root` et `.dark`
 */
export function ApplyCustomerUiTheme({
  theme,
  enabled = true,
}: {
  theme: CustomerUiTheme;
  enabled?: boolean;
}) {
  if (!enabled) return null;

  const css = customerUiCssText(theme);
  return (
    <style
      // Présent dès le HTML initial → pas de FOUC couleurs
      dangerouslySetInnerHTML={{
        __html: `html,html.light,html.dark{${css}}`,
      }}
    />
  );
}
