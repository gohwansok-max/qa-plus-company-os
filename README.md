# QA+ Company OS MVP

스크린샷의 Company OS 구조를 QA+ 운영에 맞게 재설계한 로컬 우선 MVP입니다.

공개 MVP: <https://gohwansok-max.github.io/qa-plus-company-os/>

## 실행

`run-company-os.bat`를 더블클릭하거나 PowerShell에서 다음을 실행합니다.

```powershell
cd "G:\내 드라이브\09_AI 모델 하네스 만들기\ai-ceo-os\company-os"
python server.py
```

브라우저 주소: `http://127.0.0.1:8877`

이 저장소와 `ai-ceo-os` 폴더를 같은 상위 폴더에 두면 기존 QA+ 주제·산출물·스크립트·에이전트 개수를 자동으로 읽습니다. 다른 위치에 있다면 실행 전에 연결 경로를 지정합니다.

```powershell
$env:QA_SOURCE_PROJECT="G:\내 드라이브\09_AI 모델 하네스 만들기\ai-ceo-os"
python server.py
```

## 현재 기능

- 실제 프로젝트의 주제·블로그·영상·스크립트·에이전트·하네스 개수 표시
- 콘텐츠 작업 등록과 단계 이동
- 작업·승인·활동 이력을 `data/os_state.json`에 로컬 저장
- OSMU 표준 파이프라인, AI 임원진, 자동화 모듈, 지식창고 화면
- 외부 발행과 비밀정보 저장 차단

GitHub Pages 공개 버전은 서버가 없으므로 업무 상태를 사용자 브라우저의 로컬 저장소에 보관합니다. 다른 기기나 브라우저와 자동 동기화되지는 않습니다.

## 다음 연결 단계

1. 블로그 생성 스크립트를 공통 작업 규격으로 연결
2. 쇼츠 생성 스크립트를 공통 작업 규격으로 연결
3. 산출물 미리보기와 출처 체크리스트 추가
4. 대표 승인 후에만 별도 발행 버튼 활성화

광고·CRM·결제·문자·웨비나 기능은 QA+ 1차 핵심 업무가 아니므로 MVP에서 제외했습니다.
