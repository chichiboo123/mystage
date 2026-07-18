// 배움터 — 무대 이론 학습 콘텐츠
// 내용은 국립극장 무대예술용어집, Theatres Trust 극장 유형 자료,
// 미국 무대기술 표준 교재(Gillette, Theatrical Design and Production) 등을 참고해 작성했습니다.

const SOURCES_COMMON = `
<div class="edu-sources">
  <h3>📎 참고 자료</h3>
  <ul>
    <li>국립극장, 『무대예술용어집』 — <a href="https://www.ntok.go.kr" target="_blank" rel="noopener">ntok.go.kr</a></li>
    <li>Theatres Trust(영국 극장 보존 재단), "Theatre Design: Stage Types" — <a href="https://www.theatrestrust.org.uk" target="_blank" rel="noopener">theatrestrust.org.uk</a></li>
    <li>J. Michael Gillette, 『Theatrical Design and Production』 (McGraw-Hill) — 미국 대학 무대기술 표준 교재</li>
    <li>USITT(미국무대기술협회) 공연기술 용어 자료 — <a href="https://www.usitt.org" target="_blank" rel="noopener">usitt.org</a></li>
  </ul>
</div>`;

export const EDU_TABS = [
  {
    id: 'stages',
    title: '🏛️ 무대의 종류',
    html: `
<h3>무대와 객석이 만나는 네 가지 방법</h3>
<p>극장을 나누는 가장 중요한 기준은 <b>관객이 무대를 어느 방향에서 바라보는가</b>예요. 대표적인 네 가지 형태를 알아볼까요?</p>

<h3>🏛️ 프로시니엄 무대 (Proscenium Stage)</h3>
<p>무대와 객석 사이에 <span class="term">프로시니엄 아치</span>라는 큰 틀이 있고, 관객은 <b>한쪽(정면)에서만</b> 무대를 바라봐요. 마치 액자 속 그림을 보는 것 같아서 '액자 무대'라고도 해요.</p>
<ul>
  <li><b>구조:</b> 아치 뒤로 막(커튼), 무대 옆의 숨는 공간 <span class="term">윙(옆무대)</span>, 조명·막을 매다는 <span class="term">배튼</span>, 맨 뒤의 <span class="term">배경막(사이클로라마)</span>이 있어요.</li>
  <li><b>좋은 점:</b> 장치와 배우를 숨겼다가 등장시키기 좋아서 장면 전환이 편해요.</li>
  <li><b>아쉬운 점:</b> 관객과 배우 사이가 조금 멀게 느껴질 수 있어요.</li>
</ul>

<h3>📐 돌출 무대 (Thrust Stage)</h3>
<p>무대가 객석 쪽으로 <b>혀처럼 쑥 나와</b> 있고, 관객이 <b>앞과 좌우 3면</b>에서 둘러싸요. 셰익스피어 시대의 극장이 이 형태였어요.</p>
<ul>
  <li><b>구조:</b> 뒤쪽에만 낮은 배경이 있고, 무대 위는 대부분 비워 둬요. 3면 어디서나 잘 보여야 하니까 <b>높은 장치를 적게</b> 써요.</li>
  <li><b>좋은 점:</b> 배우가 관객 가까이 다가갈 수 있어 생생하고 친밀해요.</li>
</ul>

<h3>⭕ 사방 객석 무대 (Arena Stage / Theatre-in-the-Round)</h3>
<p>관객이 무대의 <b>사방(360도)을 완전히 둘러싸는</b> 형태예요. '원형 무대'라고 흔히 부르지만, 사실 <b>무대 바닥이 꼭 원형일 필요는 없어요.</b> 정사각형·직사각형 바닥의 사방 객석 무대도 많답니다. (My Stage에서는 원형 바닥을 예시로 보여줘요.)</p>
<ul>
  <li><b>구조:</b> 어느 방향 관객의 시야도 가리면 안 되니까 <b>배경막이 없고</b>, 낮은 소품과 <b>천장 조명</b>으로 장면을 표현해요. 배우는 객석 사이 통로로 등장해요.</li>
  <li><b>좋은 점:</b> 모든 자리가 무대와 가까워요.</li>
  <li><b>과제:</b> 배우의 등이 늘 어느 쪽 관객을 향하게 되므로 움직임(동선)을 잘 짜야 해요.</li>
</ul>

<h3>⬛ 블랙박스 (Black Box)</h3>
<p>블랙박스는 정해진 무대 형태가 <b>아니에요!</b> 검게 칠한 <b>빈 공간</b>과 천장의 <b>조명 그리드</b>만 있고, 무대와 객석을 공연마다 <b>마음대로 다시 배치</b>할 수 있는 <span class="term">가변형 공연 공간</span>이에요.</p>
<ul>
  <li>오늘은 프로시니엄처럼, 내일은 돌출 무대처럼, 모레는 사방 객석으로! 이동식 플랫폼과 의자로 매번 새로운 극장을 만들 수 있어요.</li>
  <li>My Stage의 블랙박스에서도 블록과 의자 소품으로 여러분만의 배치를 실험해 보세요.</li>
</ul>

<h3>🌳 야외 무대 (Open-air Stage)</h3>
<p>하늘이 천장인 무대예요. 고대 그리스의 야외 원형극장이 서양 극장의 출발점이었죠. 야외 무대는 정해진 형태가 없어서 숲속 빈터, 바닷가 모래사장, 광장 등 <b>장소의 특징을 살려</b> 만들어요.</p>

<div class="edu-note">🤔 <b>생각해 보기</b> — 우리 반 공연에는 어떤 형태가 어울릴까요? 멋진 배경이 중요하면 프로시니엄, 관객과 가까운 게 중요하면 돌출이나 사방 객석!</div>
${SOURCES_COMMON}
`,
  },
  {
    id: 'areas',
    title: '📍 무대의 방향과 구역',
    html: `
<h3>무대 위에도 약속된 주소가 있어요</h3>
<p>"오른쪽으로 가 주세요"라고 하면 누구의 오른쪽일까요? 헷갈리지 않도록 극장에서는 방향의 기준을 약속해 두었어요.</p>

<h3>배우 기준: 무대 오른쪽(SR)과 무대 왼쪽(SL)</h3>
<ul>
  <li><span class="term">무대 오른쪽 (Stage Right, SR)</span> — 무대에 서서 <b>객석을 바라보는 배우</b>의 오른쪽</li>
  <li><span class="term">무대 왼쪽 (Stage Left, SL)</span> — 그 배우의 왼쪽</li>
</ul>
<p>연출가, 배우, 무대 스태프는 모두 <b>배우 기준</b>으로 말해요. 그래야 무대 위에서 헷갈리지 않으니까요.</p>

<h3>관객 기준: 객석 오른쪽(HR)과 객석 왼쪽(HL)</h3>
<ul>
  <li><span class="term">객석 오른쪽 (House Right, HR)</span> — <b>객석에 앉은 관객</b>이 무대를 볼 때의 오른쪽</li>
  <li><span class="term">객석 왼쪽 (House Left, HL)</span> — 그 관객의 왼쪽</li>
</ul>
<p>그래서 <b>무대 오른쪽(SR)은 관객 눈에는 왼쪽</b>에 보여요! 서로 마주 보고 있으니까요. 안내원이나 객석 스태프는 관객 기준(HR/HL)을 써요.</p>

<h3>업스테이지와 다운스테이지</h3>
<ul>
  <li><span class="term">업스테이지(Upstage, 윗무대)</span> — 객석에서 <b>먼 뒤쪽</b></li>
  <li><span class="term">다운스테이지(Downstage, 아랫무대)</span> — 객석과 <b>가까운 앞쪽</b></li>
</ul>
<p>왜 뒤가 '업(위)'일까요? 옛날 유럽 극장의 무대는 뒤로 갈수록 높아지는 <span class="term">경사 무대(raked stage)</span>였어요. 뒤쪽이 정말로 '위'였기 때문에 지금도 이 이름이 남아 있답니다.</p>

<h3>무대 9구역</h3>
<p>방향을 합치면 무대를 9개 구역으로 나눌 수 있어요. 상단의 <b>📍 구역</b> 스위치를 켜면 무대 바닥에서 직접 확인할 수 있어요. (관객 시점 화면에서는 SR 구역이 왼쪽에 보여요!)</p>
<table>
  <tr><th></th><th>무대 오른쪽 (SR)</th><th>중앙</th><th>무대 왼쪽 (SL)</th></tr>
  <tr><th>윗무대 (US)</th><td>윗무대 오른쪽<br>USR</td><td>윗무대 중앙<br>USC</td><td>윗무대 왼쪽<br>USL</td></tr>
  <tr><th>중간</th><td>무대 오른쪽<br>SR</td><td>⭐ 무대 중앙<br>CS</td><td>무대 왼쪽<br>SL</td></tr>
  <tr><th>아랫무대 (DS)</th><td>아랫무대 오른쪽<br>DSR</td><td>아랫무대 중앙<br>DSC</td><td>아랫무대 왼쪽<br>DSL</td></tr>
</table>

<h3>상수와 하수는 뭐예요?</h3>
<p>우리나라와 일본의 공연 현장에서는 전통적으로 <span class="term">상수(上手)</span>·<span class="term">하수(下手)</span>라는 말도 써요.</p>
<ul>
  <li><b>무대 오른쪽(SR)</b> = <b>하수</b>라고도 불러요</li>
  <li><b>무대 왼쪽(SL)</b> = <b>상수</b>라고도 불러요</li>
</ul>
<p>지금도 현장에서 쓰이는 말이지만 기준이 헷갈리기 쉬워서, My Stage에서는 <b>한국어 이름과 SR·SL 표기를 우선</b>으로 사용해요.</p>

<div class="edu-note">💡 <b>사방 객석 무대와 블랙박스</b>는 정면이 정해져 있지 않아요. 이 앱에서는 <b>객석 쪽(화면 아래)을 기준 정면</b>으로 정해서 구역을 표시해요. 실제 공연에서도 연출가가 "이쪽을 정면으로 하자"라고 기준을 먼저 약속한답니다.</div>
${SOURCES_COMMON}
`,
  },
  {
    id: 'lighting',
    title: '💡 조명 이야기',
    html: `
<h3>조명은 무대의 마법사</h3>
<p>무대 조명이 하는 일은 네 가지예요.</p>
<ul>
  <li><b>보이게 하기</b> — 가장 기본! 배우와 무대를 관객에게 보여줘요.</li>
  <li><b>집중시키기</b> — 밝은 곳으로 관객의 눈이 저절로 따라가요.</li>
  <li><b>분위기 만들기</b> — 파란빛은 차갑고 쓸쓸하게, 주황빛은 따뜻하고 정답게.</li>
  <li><b>시간과 장소 표현</b> — 노을, 한밤중, 숲속 햇살까지 빛으로 그려요.</li>
</ul>

<h3>조명 기구의 종류</h3>
<ul>
  <li><span class="term">스포트라이트(Spotlight)</span> — 한 곳을 동그랗게 콕 집어 비추는 조명</li>
  <li><span class="term">팔로우 스팟(Follow Spot)</span> — 객석 뒤에서 사람이 직접 조작하며 배우를 따라다니는 조명</li>
  <li><span class="term">워시/플러드(Wash·Flood)</span> — 무대 전체를 넓고 부드럽게 적시듯 비추는 조명</li>
  <li><span class="term">무빙 라이트(Moving Light)</span> — 컴퓨터로 방향과 색이 바뀌는 조명. 콘서트의 주인공!</li>
  <li><span class="term">풋라이트/플로어 라이트</span> — 바닥에서 위로 쏘아 극적인 그림자를 만드는 조명</li>
</ul>

<h3>빛의 색 — 컬러 젤과 가산혼합</h3>
<p>조명 앞에 <span class="term">젤(Gel)</span>이라는 색 필터를 끼우면 빛의 색이 바뀌어요. 물감과 달리 <b>빛은 섞을수록 밝아져요(가산혼합)</b>: 빨강+초록=노랑, 빨강+파랑=마젠타, 셋을 다 섞으면 흰빛!</p>

<h3>얼굴을 입체적으로 — 매캔들리스 방식</h3>
<p>조명 디자이너 스탠리 매캔들리스가 정리한 유명한 방법이에요. 배우의 <b>양쪽 45도 위</b>에서 하나는 <b>따뜻한 색</b>, 하나는 <b>차가운 색</b>으로 비추면 얼굴이 자연스럽고 입체적으로 보여요. 조명 탭의 <b>매캔들리스 세트</b>로 바로 실험해 보세요!</p>

<h3>조명 큐(Cue)</h3>
<p><span class="term">큐</span>는 "지금 조명을 바꿔!"라는 약속된 신호예요. 실제 공연에서는 무대감독이 "라이트 큐 5, 고!"라고 외치면 조명 오퍼레이터가 미리 저장해 둔 조명 상태로 바꿔요. My Stage의 <b>🎬 공연 탭 → 조명 큐</b>가 바로 이 방식이에요.</p>

<div class="edu-note">🌙 <b>공연 모드</b>를 켜면 객석 조명(하우스 라이트)이 꺼지고 여러분이 만든 무대 조명만 남아요 — 진짜 공연이 시작되는 순간이에요!</div>
${SOURCES_COMMON}
`,
  },
  {
    id: 'terms',
    title: '📖 무대 용어 사전',
    html: `
<h3>극장 사람들의 언어</h3>
<ul>
  <li><span class="term">프로시니엄 아치</span> — 무대와 객석을 나누는 액자 모양의 큰 틀</li>
  <li><span class="term">에이프런(Apron)</span> — 막보다 객석 쪽으로 나온 무대의 앞부분</li>
  <li><span class="term">윙(Wing, 옆무대)</span> — 무대 양옆, 관객에게 보이지 않는 공간. 배우가 등장을 기다려요</li>
  <li><span class="term">사이클로라마(Cyc)</span> — 무대 맨 뒤의 커다란 배경막. 조명으로 하늘·노을을 그려요</li>
  <li><span class="term">배튼(Batten)</span> — 무대 위에 가로로 매달린 긴 봉. 조명과 막을 걸어요</li>
  <li><span class="term">플라이(Fly)</span> — 무대 위쪽 공간. 배경막을 끌어올려 숨겨두는 곳</li>
  <li><span class="term">마스킹(Masking)</span> — 보이면 안 되는 곳을 검은 막으로 가리는 일</li>
  <li><span class="term">하우스(House)</span> — 객석. '하우스 라이트'는 객석의 조명이에요</li>
  <li><span class="term">보메토리(Vomitory)</span> — 객석 사이를 지나 무대로 이어지는 통로. 돌출·사방 객석 무대의 등장로!</li>
  <li><span class="term">블랙아웃(Blackout)</span> — 모든 조명을 한 번에 꺼서 캄캄하게 만드는 것</li>
  <li><span class="term">큐(Cue)</span> — 조명·음향·배우가 움직이는 약속된 신호</li>
  <li><span class="term">리허설(Rehearsal)</span> — 공연 전 연습. 조명·음향까지 맞추면 '테크니컬 리허설'</li>
  <li><span class="term">커튼콜(Curtain Call)</span> — 공연이 끝나고 배우들이 인사하는 시간 👏</li>
  <li><span class="term">소품(Prop)</span> — 배우가 사용하는 물건들. Property의 줄임말</li>
  <li><span class="term">무대감독(Stage Manager)</span> — 공연의 모든 큐를 지휘하는 무대 뒤의 캡틴</li>
</ul>
${SOURCES_COMMON}
`,
  },
  {
    id: 'activity',
    title: '🏫 함께 해봐요',
    html: `
<h3>선생님·친구들과 함께하는 활동</h3>
<p>My Stage로 할 수 있는 미션이에요. 완성하면 <b>저장·공유 → 사진 찍기</b>로 저장해서 발표해 보세요!</p>

<h3>🎯 미션 카드</h3>
<ul>
  <li><b>미션 1 — 학예회 무대:</b> 우리 반 학예회 무대를 디자인해 보세요. 노래·연극·댄스 중 무엇을 위한 무대인가요?</li>
  <li><b>미션 2 — 아침에서 밤으로:</b> 조명 큐 두 개로 같은 무대를 '아침 장면'→'밤 장면'으로 전환해 보세요.</li>
  <li><b>미션 3 — 주인공을 찾아라:</b> 배우 5명을 세우고, 조명 하나로 시선이 한 명에게만 모이게 해 보세요.</li>
  <li><b>미션 4 — 방향 놀이:</b> 구역 표시를 켜고 "USR로 이동!" 같은 지시를 서로 내려 보세요. 배우 기준이라는 걸 잊지 마세요!</li>
  <li><b>미션 5 — 블랙박스 실험:</b> 블랙박스에서 객석 의자를 두 방향으로 배치해 서로 다른 극장을 만들어 보세요.</li>
  <li><b>미션 6 — 매캔들리스 도전:</b> 배우 한 명에게 따뜻한 색+차가운 색 조명을 양쪽 45도에서 비춰 보세요.</li>
  <li><b>미션 7 — 환경 무대:</b> 숲·바다·우주 무대 중 하나를 골라, 그 장소에 어울리는 공연을 상상해 꾸며 보세요.</li>
</ul>

<h3>💬 발표하고 이야기 나누기</h3>
<ul>
  <li>왜 이 무대 형태를 골랐나요? 관객은 어디에서 보게 되나요?</li>
  <li>조명 색으로 어떤 기분을 표현했나요?</li>
  <li>실제로 만든다면 무엇이 가장 어려울까요?</li>
</ul>

<div class="edu-note">👩‍🏫 <b>선생님께</b> — <b>내보내기</b>로 학생 작품을 파일로 모으고, <b>불러오기</b>로 큰 화면에서 함께 감상할 수 있어요. 무대 구역(📍 구역)과 배움터 내용은 연극 단원 수업 자료로 활용해 보세요.</div>
`,
  },
];
