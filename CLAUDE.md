# iRMS 샘플 App

악성 샘플 조회 앱 (vt_metadata 이식). 해시/진단명 검색, 샘플 상세(벤더별 진단명),
멀티 해시 검색, 통계 대시보드, 단건/배치 다운로드를 제공한다.
BE 는 sample-service (`/api/sample/*`).

## 책임

- `GET /api/sample/samples` 검색 목록 (cursor+snapshot_idx 페이지네이션)
- `GET /api/sample/samples/{hash}` 상세 (64hex→sha256, 32hex→md5)
- `POST /api/sample/samples/multi-search` 멀티 검색 (최대 500)
- `GET /api/sample/samples/{hash}/download` 단건 다운로드 (blob)
- `POST /api/sample/samples/batch-download` 배치 다운로드 (AES ZIP, 최대 50, pw `infected`)
- `GET /api/sample/meta/filters` 필터 옵션 사전 (id+name)
- `GET /api/sample/stats/*` KPI/일별/타입/로케일/진단율/TOP 진단명 통계

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
| `getStats*` | `/api/sample/stats/*` | GET | 통계 대시보드 |

계약 SoT: `iRMS_BE/docs/plan/vt-sample-service.md` (구현 후 Swagger).

## 상세 정책

| 정책 | 문서 |
| --- | --- |
| API 클라이언트 | `common/docs/api-client.md` |
| 페이지네이션 | `common/docs/pagination.md` |
| 레이아웃/중앙 메시지 | `common/docs/layout.md` |
| 테마/팔레트 | `common/docs/theme.md` |
