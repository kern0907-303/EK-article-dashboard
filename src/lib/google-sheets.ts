import { WorkspaceData, SEOKeyword, AdDataItem } from "./firebase";

export interface Project {
  id: string;
  name: string;
  guidelines: string;
  social_copy?: string;
  web_architecture?: string;
  seo_keywords?: string | SEOKeyword[];
  ad_data?: string | AdDataItem[];
  aeo_schema?: string;
  aeo_faq?: string;
}

/**
 * 試算表回傳與發送的資料轉換
 */
export function formatProjectToWorkspace(project: Project): WorkspaceData {
  let seo_keywords: SEOKeyword[] = [];
  try {
    if (project.seo_keywords) {
      seo_keywords = typeof project.seo_keywords === "string"
        ? JSON.parse(project.seo_keywords)
        : project.seo_keywords;
    }
  } catch (e) {
    console.error("Failed to parse seo_keywords from sheet:", e);
  }

  let ad_data: AdDataItem[] = [];
  try {
    if (project.ad_data) {
      ad_data = typeof project.ad_data === "string"
        ? JSON.parse(project.ad_data)
        : project.ad_data;
    }
  } catch (e) {
    console.error("Failed to parse ad_data from sheet:", e);
  }

  return {
    brand_guidelines: project.guidelines || "",
    social_copy: project.social_copy || "",
    web_architecture: project.web_architecture || "",
    seo_keywords,
    ad_data,
    aeo_schema: project.aeo_schema || "",
    aeo_faq: project.aeo_faq || ""
  };
}
