import favicons from "favicons";
export const loadFavIcons = async () =>
  await favicons(
    "../node_modules/@rewind-media/rewind-web/dist/static/img/RewindIcon-Basic.svg"
  );
