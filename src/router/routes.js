const routes = [
  {
    path: "/",
    name: "WritingIntelligible",
    component: () => import("src/layouts/WritingLayout.vue"),
    meta: { requiresAuth: false }
  },
  {
    path: "/:catchAll(.*)*",
    component: () => import("src/layouts/WritingLayout.vue"),
    meta: { requiresAuth: false }
  },
];

export default routes;
