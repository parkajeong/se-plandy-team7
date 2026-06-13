export default {
  expo: {
    name: "Plandy",
    slug: "plandy-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "plandy",
    userInterfaceStyle: "automatic",
    web: {
      output: "single",
      favicon: "./assets/images/icon.png",
    },

    android: {
      versionCode: 1,
      icon: "./assets/images/icon.png",
      adaptiveIcon: {
        foregroundImage: "./assets/images/icon.png",
        backgroundColor: "#FFFFFF",
      },
      package: "com.team7.plandy",
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
      "@react-native-google-signin/google-signin",
    ],

    extra: {
      eas: {
        projectId: "30960e38-0ce6-4834-a869-2e4baa81e5ed",
      },
    },
  },
};
