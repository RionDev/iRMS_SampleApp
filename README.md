# iRMS 샘플 App

악성 샘플 조회 앱. photon-db 의 샘플 메타데이터를 sample-service(BE) 를 통해
검색/조회하고 샘플 파일을 다운로드한다. (vt_metadata 웹서비스 이식)

## 기능

- **샘플 검색**: SHA256/MD5 해시 또는 진단명 검색(항상 부분일치), cursor 기반
  이전/다음 페이지네이션. 필터는 VirusTotal 스타일 검색 문법으로 검색어에 섞어
  쓴다 — `format:exe category:document pool:black locale:KR source:x
  tag:stealer label:trojan` 에 더해 파일 타입 세부 필터
  `spectype:` `compiler:` `linker:` `library:` `crypter:` `overlay:` `resource:`
  지원 (`tag`/`label`은 반복 시 AND, 공백 값은 `tag:"a b"`.
  label 은 trojan/ransomware 같은 VT 위협 유형, category 는 Archive/Document
  같은 파일 타입 분류), `ratio:30..70`·`ratio:50`(진단율),
  `date:2026-01-01..2026-06-30`(등록일).
  사전 값은 부분 입력 허용 — `locale:china`처럼 여러 값에 걸리면 전부 OR 검색
  (tag/label 은 AND 규약이라 유일해야 하며, 모호하면 후보 안내).
  필터(깔때기) 버튼을 누르면 검색바 블럭이 확장되어 select 로 고를 수 있고
  선택하면 검색어에 토큰이 자동 반영된다. "?" 도움말에서 문법·값 목록 확인 가능.
  입력 오류는 검색바 아래에 전문 표시
- **멀티 해시 검색**: 검색바에 해시 목록(최대 500개)을 붙여넣으면 같은 화면에서
  일치/불일치 분리 표시 (VirusTotal 방식 — 별도 화면 없음, 상세 필터 미적용),
  최대 50개 선택 배치 다운로드 (AES ZIP, 비밀번호 `infected`)
- **샘플 상세**: 검색 화면 위 오버레이 드로어로 표시 (페이지 이동 없음 — 검색
  결과/페이지 상태 유지). 해시 3종(SHA256/MD5/SSDEEP) 복사, 파일 타입 상세,
  진단율 게이지, 벤더별 진단명 테이블, 태그/라벨, 파일 다운로드 (미보관 시 비활성)

통계 화면은 이 앱에 없다 — 통계는 통계 앱(`/statistics`) 담당.

## 기술 스택

React 18 + TypeScript, Vite, Zustand/Axios (common 제공), Vitest + RTL

## 라우트

| 경로 | 페이지 | 설명 |
| --- | --- | --- |
| `/sample/` | SearchPage | 검색바 + 결과 테이블 (멀티 해시 검색, 상세 드로어 포함) |

구 `/sample/multi`, `/sample/stats`, `/sample/samples/:hash` 경로는 `/sample/` 로
리다이렉트된다.

## 연동 BE API

Base `/api/sample` (sample-service, 게이트웨이 경유). 계약 SoT:
`iRMS_BE/docs/plan/vt-sample-service.md` → 구현 후 `/api/sample/docs` Swagger.

기본 설정은 실제 BE를 사용한다. UI 단독 개발이 필요할 때만 `.env`의
`VITE_USE_MOCK=1`을 설정한다.

## 개발

```bash
npm install
npm run dev
```

기본 포트: 3005, 경로: `/sample/`

## 사전 준비

```bash
git submodule update --init --recursive
```
