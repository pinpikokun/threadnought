export type TemplateVars = {
  顧客名?: string;
  チケット番号?: string;
  担当者名?: string;
};

// {{キー}}（前後空白許容）を対応する値に置換。未定義キーは空文字。
export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (_match, key: string) => {
    const v = (vars as Record<string, string | undefined>)[key];
    return v ?? "";
  });
}
