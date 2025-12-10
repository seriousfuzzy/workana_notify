// Types for Workana job data structure
export interface WorkanaJob {
  slug: string;
  title: string;
  url: string;
  authorName: string;
  description: string;
  isHourly: boolean;
  deadline: string | null;
  deadlineValue: string;
  isSearchFeatured: boolean;
  postedDate: string;
  lastEmployerMessage: string | null;
  isUrgent: boolean;
  budget: string;
  skills: Array<{
    anchorText: string;
    anchorLink: string;
    isCertified: boolean;
    title: string;
  }>;
  rating: {
    value: string;
    label: string;
  };
  hasVerifiedPaymentMethod: boolean;
  country: string;
  totalBids: string;
  publishedDate: string;
  profileLogo: string;
}

export interface WorkanaResponse {
  results: {
    resultDescription: {
      count: number;
      showResultCount: boolean;
      emptyResultLabel: string;
      notEmptyResultLabel: string;
    };
    results: WorkanaJob[];
    pagination: {
      total: number;
      limit: number;
      page: number;
      pages: number;
    };
  };
}

export interface ExtensionConfig {
  discordWebhookUrl: string;
  monitoringInterval: number; // in milliseconds
  isMonitoring: boolean;
  lastCheckTime: number | null;
}

export interface StoredJobs {
  jobs: WorkanaJob[];
  lastUpdate: number;
}

