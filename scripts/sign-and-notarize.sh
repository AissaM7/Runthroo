#!/bin/bash
set -euo pipefail

APP_NAME="Runthroo"
SIGNING_IDENTITY="Developer ID Application: Aissa Mamdouh (H8LH2P5FMH)"
NOTARY_PROFILE="notarytool-profile"
DMG_SOURCE="./dmg-source"

ENTITLEMENTS=""

echo "==> Cleaning previous build artifacts"
rm -f "${APP_NAME}.dmg"

echo "==> Signing ${APP_NAME}.app"
codesign --deep --force --verify --verbose \
  --sign "${SIGNING_IDENTITY}" \
  --options runtime \
  --timestamp \
  ${ENTITLEMENTS} \
  "${DMG_SOURCE}/${APP_NAME}.app"

echo "==> Verifying app signature"
codesign --verify --deep --strict --verbose=2 "${DMG_SOURCE}/${APP_NAME}.app"
spctl --assess --type exec -vvv "${DMG_SOURCE}/${APP_NAME}.app"

echo "==> Creating DMG"
create-dmg \
  --volname "${APP_NAME}" \
  --background "dmg-background.png" \
  --window-pos 200 120 \
  --window-size 660 400 \
  --icon-size 80 \
  --icon "${APP_NAME}.app" 180 190 \
  --hide-extension "${APP_NAME}.app" \
  --app-drop-link 480 190 \
  --no-internet-enable \
  "${APP_NAME}.dmg" \
  "${DMG_SOURCE}/"

echo "==> Signing DMG"
codesign --force --sign "${SIGNING_IDENTITY}" --timestamp "${APP_NAME}.dmg"

echo "==> Submitting for notarization (this may take 2-15 minutes)"
xcrun notarytool submit "${APP_NAME}.dmg" \
  --keychain-profile "${NOTARY_PROFILE}" \
  --wait

echo "==> Stapling notarization ticket"
xcrun stapler staple "${APP_NAME}.dmg"
xcrun stapler validate "${APP_NAME}.dmg"

echo ""
echo "==> Done. ${APP_NAME}.dmg is ready for upload."
echo "    Copy it to: downloads/${APP_NAME}.dmg"
