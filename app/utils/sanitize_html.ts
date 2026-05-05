export const sanitizeHtml = (html = "") => {
    if (!html) return "";
    const DOMParserCtor = (globalThis as { DOMParser?: new () => { parseFromString: (input: string, type: string) => any } }).DOMParser;
    if (!DOMParserCtor) return html;
    const doc = new DOMParserCtor().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style").forEach((node: any) => node.remove());
    doc.querySelectorAll("*").forEach((el: any) => {
        const attrs = Array.from(el.attributes ?? []) as Array<{ name: string; value: string }>;
        for (const attr of attrs) {
            if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
            if (
                attr.name === "href" &&
                attr.value.trim().toLowerCase().startsWith("javascript:")
            ) {
                el.removeAttribute("href");
            }
        }
    });
    // Allow only a white-list set of tags/attrs by reconstructing innerHTML
    // For now, return cleaned innerHTML
    return doc.body.innerHTML.trim();
};
