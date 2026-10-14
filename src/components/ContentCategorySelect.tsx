import { contentCategoryLabel, useI18n } from "../locales/i18n";
import { contentCategories, type ContentCategory } from "../utils/contentClassifier";

export function ContentCategorySelect({
  value, counts, total, onChange,
}: {
  value: "all" | ContentCategory;
  counts: Record<ContentCategory, number>;
  total: number;
  onChange: (value: "all" | ContentCategory) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <label className="select-field category-select">
      <span>{t("discover.filterContent")}</span>
      <select value={value} aria-label={t("discover.filterContent")}
        onChange={(event) => onChange(event.target.value as "all" | ContentCategory)}>
        <option value="all">{t("discover.categoryOption", {
          category: t("discover.allTypes"), count: total,
        })}</option>
        {contentCategories.filter((category) => counts[category] > 0).map((category) => (
          <option key={category} value={category}>{t("discover.categoryOption", {
            category: contentCategoryLabel(locale, category), count: counts[category],
          })}</option>
        ))}
      </select>
    </label>
  );
}
