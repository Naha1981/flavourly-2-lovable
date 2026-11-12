export const FLAVOURLY_LIVE_TOOLS = [
  {
    name: "get_restaurant_overview",
    behavior: "BLOCKING",
    description: "Get verified restaurant profile information such as restaurant name, WhatsApp configuration and auto-reply status.",
  },
  {
    name: "get_revenue_status",
    behavior: "BLOCKING",
    description: "Check whether verified revenue data is currently available. Never invent revenue figures when it is unavailable.",
  },
  {
    name: "get_today_bookings",
    behavior: "BLOCKING",
    description: "Get today's confirmed, seated, completed, cancelled and no-show bookings for this restaurant.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: {
          type: "INTEGER",
          description: "Maximum number of bookings to return.",
        },
      },
    },
  },
  {
    name: "get_menu_performance",
    behavior: "BLOCKING",
    description: "Get the restaurant's best-selling menu items from the last 30 days, including prices and availability.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: {
          type: "INTEGER",
          description: "Maximum number of menu items to return, from 1 to 10.",
        },
      },
    },
  },
  {
    name: "get_inbox_summary",
    behavior: "BLOCKING",
    description: "Get open WhatsApp conversations, unread message counts, urgent conversations and recent guest messages.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: {
          type: "INTEGER",
          description: "Maximum number of recent conversations to return, from 1 to 10.",
        },
      },
    },
  },
  {
    name: "get_vip_customers",
    behavior: "BLOCKING",
    description: "Get VIP customers and their verified spend and visit counts.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: {
          type: "INTEGER",
          description: "Maximum number of VIP customers to return, from 1 to 10.",
        },
      },
    },
  },
  {
    name: "draft_promotion",
    behavior: "BLOCKING",
    description: "Create a social promotion draft using only real menu items. This never publishes or sends anything.",
    parameters: {
      type: "OBJECT",
      properties: {
        theme: {
          type: "STRING",
          description: "Promotion theme, such as Tuesday special or tonight's dinner.",
        },
        offer: {
          type: "STRING",
          description: "Optional offer wording supplied by the manager.",
        },
        audience: {
          type: "STRING",
          description: "Optional audience, such as dormant guests or local diners.",
        },
      },
      required: ["theme"],
    },
  },
] as const;

export type FlavourlyLiveToolName = (typeof FLAVOURLY_LIVE_TOOLS)[number]["name"];
