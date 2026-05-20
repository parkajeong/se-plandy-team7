export default {
  expo: {
    name: "Plandy",
    slug: "plandy-app",
    scheme: "plandy",

    android: {
      package: "com.plandy.app",
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
    },

    plugins: [
      [
        "expo-build-properties",
        {
          android: {
            extraMavenRepos: [
              "https://devrepo.kakao.com/nexus/content/groups/public/",
            ],
          },
        },
      ],
      "expo-web-browser",
    ],

    extra: {
      eas: {
        projectId: "30960e38-0ce6-4834-a869-2e4baa81e5ed",
      },
    },
  },
};