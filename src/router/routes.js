const routes = [
  {
    path: "/",
    name: "Main",
    component: () => import("src/layouts/MainLayout.vue"),
    meta: { requiresAuth: false }
  },
  {
    path: "/:catchAll(.*)*",
    component: () => import("src/layouts/MainLayout.vue"),
    meta: { requiresAuth: false }
  },
];

export default routes;
