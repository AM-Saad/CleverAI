export const sanitizeHtml = (html = "") => {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style").forEach((n) => n.remove());
    doc.querySelectorAll("*").forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
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