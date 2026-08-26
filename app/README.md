# Re:Call 앱 껍데기

웹앱을 안드로이드·아이폰 앱으로 감싸는 부분입니다.
**감싸는 이유는 하나입니다 — 주소록에 바로 쓰기 위해서입니다.**

브라우저는 보안상 주소록에 손댈 수 없습니다. 그래서 웹으로 열면
공유 시트를 거쳐야 하는데, 앱으로 감싸면 명함을 눌렀을 때
화면 하나 없이 곧장 주소록에 들어갑니다.

## 앱의 본체는 여기에 없습니다

`../network-dna.html` 파일 하나가 웹과 앱의 본체입니다.
`npm run sync` 가 그 파일을 `www/index.html` 로 복사합니다.
**앱 전용 코드를 따로 두지 않습니다.** 그 파일이 실행될 때
`window.Capacitor` 가 있는지 보고 앱인지 웹인지 스스로 가립니다.

```
network-dna.html   ← 여기만 고칩니다
      │
      ├─ 깃허브 페이지 → 브라우저 (공유 시트로 연락처 저장)
      └─ npm run sync → 앱      (주소록에 바로 저장)
```

## 준비

맥에 Android Studio 가 설치되어 있어야 합니다. 자바는 그 안에 들어 있습니다.

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
```

## 만들기

```bash
cd app
npm install          # 처음 한 번만
npm run sync         # network-dna.html 을 앱에 담습니다
cd android && ./gradlew assembleDebug
```

APK 는 `android/app/build/outputs/apk/debug/app-debug.apk` 에 생깁니다.
폰에 옮겨 설치하면 됩니다. (설정에서 "출처를 알 수 없는 앱" 허용이 필요합니다)

에뮬레이터나 USB 로 연결한 폰에 바로 넣으려면:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## 앱을 고칠 때

웹 내용을 고쳤다면 `npm run sync` 를 다시 하고 APK 를 다시 만들어야 합니다.
**앱은 자동으로 갱신되지 않습니다.** 웹은 깃허브에 올리면 바로 반영되지만,
앱은 새 APK 를 만들어 다시 설치해야 합니다. 이게 앱으로 감싼 대가입니다.

## 플레이스토어에 올리려면

지금 만든 것은 시험용(debug) APK 라 스토어에 올릴 수 없습니다. 서명한 release
빌드가 필요하고, 개발자 등록(1회 25달러)과 심사를 거쳐야 합니다.
`appId` 는 `com.dnalabs.recall` 로 두었는데, 등록 뒤에는 바꿀 수 없으니
올리기 전에 확정해 주세요.

## 권한

`AndroidManifest.xml` 에 연락처 읽기·쓰기 권한을 적어 두었습니다.
쓰기는 명함을 저장할 때 쓰고, 읽기는 플러그인이 권한 상태를 확인할 때 씁니다.
**읽은 연락처를 서버로 보내지 않습니다.**

## 아이폰

`npx cap add ios` 로 추가할 수 있습니다. 다만 맥에 Xcode 가 필요하고,
애플 개발자 등록(연 99달러)이 있어야 실기기에 넣을 수 있습니다.
아이폰은 웹으로 열어도 연락처 화면이 바로 뜨므로 급하지 않습니다.
