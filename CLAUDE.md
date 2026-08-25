# iRMS 샘플 App

악성 샘플 조회 앱 (vt_metadata 이식). 해시/진단명 검색, 샘플 상세(벤더별 진단명),
멀티 해시 검색, 단건/배치 다운로드를 제공한다.
BE 는 sample-service (`/api/sample/*`).
통계 화면은 없다 (통계 앱 `/statistics` 담당 — BE `stats/*` 엔드포인트는 남아 있으나 이 앱은 쓰지 않음).
사이드바 없이 `AppLayout hideSidebar` 를 쓴다.

멀티 해시 검색은 별도 페이지가 아니라 메인 검색바에서 처리한다 (VirusTotal 방식):
검색어에 유효 해시가 2개 이상이면 `SearchRequest.mode='multi'` 로 전환되고
필터는 적용되지 않는다. 구 `/multi` 경로는 `/` 리다이렉트로만 남아 있다.

필터는 검색어 내 `key:값` 문법으로 지정한다 (`utils/searchQuery.ts`):
사전 필터 7종(`format/category/pool/locale/source/tag/label`)은 `/meta/filters` 의
name/label 을 대소문자 무시로 id 변환해 BE 파라미터로 보낸다.
정확 일치 우선, 없으면 부분 일치 (예: `locale:KR`, `locale:china`) —
단일 lookup 필터(format/category/pool/locale/source)는 걸린 id 전부를 반복
파라미터로 보내 BE 가 OR(in_) 검색하고, tag/label 은 AND 규약이라 여러 건이면
후보와 함께 에러. `ratio:30..70`/`date:2026-01-01..` 범위 문법 지원.
모르는 key 의 콜론 토큰은 진단명 텍스트로 남긴다 (예: `Trojan:Win32/...`).
진단명은 항상 부분일치(substring)로 검색한다 (매칭 모드 select 없음).
입력 오류(없는 값, tag 모호 등)는 검색바 아래 오류 스트립에 전문 표시.

검색바 부가 UI 두 가지: "필터 ▾" 버튼은 드롭다운/입력 패널을 펼치며 선택 시
검색어에 `key:값` 토큰을 삽입/교체한다 (`upsertModifierToken`). "?" 버튼은
문법 도움말 + 사전 값 목록(아코디언/검색) 팝오버.

샘플 상세는 라우트 없이 검색 화면의 오버레이 `Drawer` 로 연다
(`components/SampleDetailPanel.tsx`, admin 패턴) — 검색/페이지 상태가 유지된다.

## 책임

- `GET /api/sample/samples` 검색 목록 (cursor+snapshot_idx 페이지네이션)
- `GET /api/sample/samples/{hash}` 상세 (64hex→sha256, 32hex→md5)
- `POST /api/sample/samples/multi-search` 멀티 검색 (최대 500)
- `GET /api/sample/samples/{hash}/download` 단건 다운로드 (blob)
- `POST /api/sample/samples/batch-download` 배치 다운로드 (AES ZIP, 최대 50, pw `infected`)
- `GET /api/sample/meta/filters` 필터 옵션 사전 (id+name)

## 공통 규칙

- 레이어: `pages / components / services / types / utils` — API 호출은 `services/`에서만
- `@common` alias 사용 (`common/` nested submodule). 공통 모듈 규칙은 `common/CLAUDE.md`
- 인증: 공통 `LoginPage`/`useAuthStore`/`useAppAccess("/sample")`. 401 은 apiClient 인터셉터 위임
- 페이지네이션: `@common/hooks/usePagedNav` (cursor 스택 + snapshot_idx echo). 규약은 `common/docs/pagination.md`

## 고유 규칙

- 독립 실행 시 Vite dev server 포트 3005, 게이트웨이 경로 `/sample/`
- **mock**: UI 단독 개발 시에만 `.env`의 `VITE_USE_MOCK=1`로
  `services/mock/` 데이터를 사용한다. 기본값은 실제 BE 연동이다
- 응답의 lookup/dict 필드는 name 문자열, 검색 필터 파라미터는 id — 혼동 주의
- 진단율 색상 규칙은 `utils/format.ts` `detectionColor` 한 곳에서만 정의
  (0 → success, ≤30% → warning, >30% → danger — 테이블/게이지 공통)
- 다운로드는 blob 응답 + `utils/format.ts` `saveBlob`. 실패 시
  `extractErrorDetail` 로 `{"detail": "not_stored"|"fetch_failed"}` 를 해석해 안내

## BE API 대응

| 서비스 함수 | 엔드포인트 | 메서드 | BE 대응 |
| --- | --- | --- | --- |
| `getSamples` | `/api/sample/samples` | GET | sample-service 검색 |
| `getSampleDetail` | `/api/sample/samples/{hash}` | GET | 상세 |
| `multiSearch` | `/api/sample/samples/multi-search` | POST | 멀티 검색 |
| `getFilterMeta` | `/api/sample/meta/filters` | GET | 필터 사전 |
| `downloadSample` | `/api/sample/samples/{hash}/download` | GET | 단건 다운로드 |
| `batchDownload` | `/api/sample/samples/batch-download` | POST | 배치 ZIP |

계약 SoT: `iRMS_BE/docs/plan/vt-sample-service.md` (구현 후 Swagger).

## 상세 정책

| 정책 | 문서 |
| --- | --- |
| API 클라이언트 | `common/docs/api-client.md` |
| 페이지네이션 | `common/docs/pagination.md` |
| 레이아웃/중앙 메시지 | `common/docs/layout.md` |
| 테마/팔레트 | `common/docs/theme.md` |
