// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxt/icon", "convex-nuxt", "@nuxtjs/tailwindcss"],
  convex: {
    url: process.env.CONVEX_URL,
  },
});