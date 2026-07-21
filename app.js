/**
 * SkyFlow - app.js (지도 제거, 기상 특보 카드 버전)
 * 지역 선택 시 기온·미세먼지·폭염·호우·폭설 특보 카드로 표시
 */

// ─── WMO 날씨 코드 ──────────────────────────────────────────────────
const WEATHER_CODES = {
    0:  { desc:"맑음",          icon:"sun" },
    1:  { desc:"대체로 맑음",   icon:"cloud-sun" },
    2:  { desc:"구름 조금",     icon:"cloud-sun" },
    3:  { desc:"흐림",          icon:"cloud" },
    45: { desc:"안개",          icon:"cloud-fog" },
    48: { desc:"침강성 안개",   icon:"cloud-fog" },
    51: { desc:"이슬비",        icon:"cloud-drizzle" },
    53: { desc:"이슬비",        icon:"cloud-drizzle" },
    55: { desc:"강한 이슬비",   icon:"cloud-drizzle" },
    61: { desc:"약한 비",       icon:"cloud-rain" },
    63: { desc:"보통 비",       icon:"cloud-rain" },
    65: { desc:"강한 비",       icon:"cloud-rain" },
    71: { desc:"약한 눈",       icon:"snowflake" },
    73: { desc:"보통 눈",       icon:"snowflake" },
    75: { desc:"강한 눈",       icon:"snowflake" },
    77: { desc:"싸락눈",        icon:"snowflake" },
    80: { desc:"소나기",        icon:"cloud-lightning-rain" },
    81: { desc:"강한 소나기",   icon:"cloud-lightning-rain" },
    82: { desc:"폭우성 소나기", icon:"cloud-lightning-rain" },
    85: { desc:"약한 소낙눈",   icon:"snowflake" },
    86: { desc:"강한 소낙눈",   icon:"snowflake" },
    95: { desc:"뇌우",          icon:"cloud-lightning" },
    96: { desc:"우박 뇌우",     icon:"cloud-lightning" },
    99: { desc:"뇌우+우박",     icon:"cloud-lightning" },
};

const DAYS = ["일요일","월요일","화요일","수요일","목요일","금요일","토요일"];

const RAINY_CODES = new Set([51,53,55,61,63,65,80,81,82,95,96,99]);
const SNOWY_CODES = new Set([71,73,75,77,85,86]);

// ─── 전국 주요 도시 특보 조회 목록 ────────────────────────────────────
const NATIONWIDE_CITIES = [
    { name:"서울", lat:37.5665, lon:126.9780 },
    { name:"부산", lat:35.1796, lon:129.0756 },
    { name:"대구", lat:35.8714, lon:128.6014 },
    { name:"인천", lat:37.4563, lon:126.7052 },
    { name:"광주", lat:35.1595, lon:126.8526 },
    { name:"대전", lat:36.3504, lon:127.3845 },
    { name:"울산", lat:35.5384, lon:129.3114 },
    { name:"강원", lat:37.8228, lon:128.1555 },
    { name:"제주", lat:33.4996, lon:126.5312 },
];

// ─── DOM ────────────────────────────────────────────────────────────
const locationDisplay    = document.getElementById("location-display");
const dateDisplay        = document.getElementById("date-display");
const tempDisplay        = document.getElementById("temp-display");
const weatherDescDisplay = document.getElementById("weather-desc-display");
const weatherIconMain    = document.getElementById("weather-icon-main");
const feelsLikeDisplay   = document.getElementById("feels-like-display");
const humidityDisplay    = document.getElementById("humidity-display");
const windDisplay        = document.getElementById("wind-display");
const popDisplay         = document.getElementById("pop-display");
const hourlyList         = document.getElementById("hourly-list");
const weeklyList         = document.getElementById("weekly-list");
const loadingOverlay     = document.getElementById("loading-overlay");
const cityChips          = document.querySelectorAll(".city-chip");
const alertCardsGrid     = document.getElementById("alert-cards-grid");
const alertRegionDisplay = document.getElementById("alert-region-display");
const nationwideGrid     = document.getElementById("nationwide-grid");
const regionQuickBtns    = document.querySelectorAll(".region-btn");
// ─── 챗봇 DOM ────────────────────────────────────────────────────────
const chatMessages       = document.getElementById("chat-messages");
const chatInput          = document.getElementById("chat-input");
const chatSendBtn        = document.getElementById("chat-send-btn");

function showLoading() { loadingOverlay?.classList.add("active"); }
function hideLoading() { loadingOverlay?.classList.remove("active"); }
function safeRound(v, fb="--") {
    return (v===undefined||v===null||isNaN(v)) ? fb : Math.round(v);
}

// ─── 기상 특보 카드 렌더링 ────────────────────────────────────────────
function renderAlertCards(data, regionName) {
    if (!alertCardsGrid) return;
    if (alertRegionDisplay) alertRegionDisplay.textContent = regionName;

    const temp   = Math.round(data.current?.temperature_2m ?? data.current_weather?.temperature ?? 20);
    const code   = data.current?.weather_code ?? data.current_weather?.weathercode ?? 0;
    const precip = data.current?.precipitation ?? 0;

    // 미세먼지: 날씨 기반 추산 (실제 API 미지원)
    const humid = data.current?.relative_humidity_2m ?? 50;
    const dust  = RAINY_CODES.has(code)
        ? 12
        : Math.max(5, Math.round(90 - humid));

    // ── 5개 특보 카드 정의 ──────────────────────────────────────────
    const cards = [
        // 1. 기온
        (() => {
            let status = "safe", sub = "정상 범위";
            if (temp >= 35) { status="danger";  sub="매우 위험"; }
            else if (temp >= 33) { status="danger";  sub="폭염 경보"; }
            else if (temp >= 28) { status="warning"; sub="더운 날씨"; }
            else if (temp <= 0)  { status="active";  sub="결빙 주의"; }
            return { icon:"🌡️", name:"기온", value:`${temp}°C`, sub, status };
        })(),
        // 2. 미세먼지
        (() => {
            let status="safe", sub="좋음";
            if (dust>=151) { status="danger";  sub="매우 나쁨"; }
            else if (dust>=81) { status="warning"; sub="나쁨"; }
            else if (dust>=31) { status="caution"; sub="보통"; }
            return { icon:"🌫️", name:"미세먼지", value:`${dust}㎍/㎥`, sub, status };
        })(),
        // 3. 폭염
        (() => {
            if (temp >= 33) return { icon:"🔥", name:"폭염", value:"경보", sub:"33°C 이상", status:"danger" };
            if (temp >= 31) return { icon:"🔥", name:"폭염", value:"주의보", sub:"31°C 이상", status:"warning" };
            return { icon:"🔥", name:"폭염", value:"없음", sub:"안전 범위", status:"safe" };
        })(),
        // 4. 호우
        (() => {
            const hasRain = RAINY_CODES.has(code) || precip > 0;
            if (precip >= 30)   return { icon:"🌧️", name:"호우", value:"경보", sub:`${precip.toFixed(1)}mm/h`, status:"danger" };
            if (hasRain)        return { icon:"🌧️", name:"호우", value:"감지", sub:`${precip.toFixed(1)}mm`, status:"active" };
            return { icon:"🌧️", name:"호우", value:"없음", sub:"강수 없음", status:"safe" };
        })(),
        // 5. 폭설
        (() => {
            const hasSnow = SNOWY_CODES.has(code);
            if (code===75||code===86) return { icon:"❄️", name:"폭설", value:"경보", sub:"강한 눈", status:"danger" };
            if (hasSnow)              return { icon:"❄️", name:"폭설", value:"감지", sub:"눈 내리는 중", status:"snow" };
            return { icon:"❄️", name:"폭설", value:"없음", sub:"강설 없음", status:"safe" };
        })(),
    ];

    alertCardsGrid.innerHTML = cards.map(c => `
        <div class="alert-card status-${c.status}">
            <span class="alert-card-icon">${c.icon}</span>
            <span class="alert-card-name">${c.name}</span>
            <span class="alert-card-value">${c.value}</span>
            <span class="alert-card-sub">${c.sub}</span>
        </div>
    `).join("");
}

// ─── 전국 도시 특보 현황 렌더링 ──────────────────────────────────────
function renderNationwideCity(cityName, temp, code, dust, precip) {
    const hasRain = RAINY_CODES.has(code) || precip > 0;
    const hasSnow = SNOWY_CODES.has(code);

    // 먼지 등급 배지
    let dustBadge = "";
    if (dust >= 151) dustBadge = `<span class="badge badge-dust-vbad">먼지↑↑</span>`;
    else if (dust >= 81) dustBadge = `<span class="badge badge-dust-bad">먼지↑</span>`;
    else if (dust >= 31) dustBadge = `<span class="badge badge-dust-mid">먼지보통</span>`;
    else dustBadge = `<span class="badge badge-dust-good">먼지좋음</span>`;

    const heatBadge = temp >= 33 ? `<span class="badge badge-heat">폭염🔥</span>` : "";
    const rainBadge = hasRain ? `<span class="badge badge-rain">호우🌧️</span>` : "";
    const snowBadge = hasSnow ? `<span class="badge badge-snow">폭설❄️</span>` : "";

    return `
        <span class="nationwide-city">${cityName} ${temp}°C</span>
        <div class="nationwide-badges">
            ${dustBadge}${heatBadge}${rainBadge}${snowBadge}
        </div>`;
}

async function fetchAllNationwide() {
    if (!nationwideGrid) return;
    nationwideGrid.innerHTML = `<div class="loading-spinner" style="grid-column:span 3">조회 중...</div>`;

    const results = await Promise.all(
        NATIONWIDE_CITIES.map(async city => {
            try {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
                    `&current=temperature_2m,weather_code,relative_humidity_2m,precipitation&timezone=auto`;
                const res  = await fetch(url);
                const data = await res.json();
                const temp   = Math.round(data.current?.temperature_2m ?? 20);
                const code   = data.current?.weather_code ?? 0;
                const humid  = data.current?.relative_humidity_2m ?? 50;
                const precip = data.current?.precipitation ?? 0;
                const dust   = RAINY_CODES.has(code)
                    ? 12                              // 비 올 때: 세정 효과로 낮게 고정
                    : Math.max(5, Math.round(90 - humid)); // 습도가 높을수록 낮게 (결정론적)
                return { name: city.name, lat: city.lat, lon: city.lon, temp, code, dust, precip };
            } catch(e) { return { name: city.name, lat: city.lat, lon: city.lon, temp: "--", code: 0, dust: 0, precip: 0 }; }
        })
    );

    // 전국 현황 카드 렌더링 + 클릭 시 해당 도시 선택 연동
    nationwideGrid.innerHTML = results.map(r =>
        `<div class="nationwide-item" style="cursor:pointer"
              data-lat="${r.lat}" data-lon="${r.lon}" data-name="${r.name}">
            ${renderNationwideCity(r.name, r.temp, r.code, r.dust, r.precip)}
        </div>`
    ).join("");

    // 클릭 이벤트 - 전국 도시 클릭 시 특보 카드 + 날씨 카드 전체 갱신
    nationwideGrid.querySelectorAll(".nationwide-item").forEach(el => {
        el.addEventListener("click", () => {
            selectCity(
                parseFloat(el.dataset.lat),
                parseFloat(el.dataset.lon),
                el.dataset.name
            );
        });
    });
}

// ─── 현재 날씨 카드 갱신 ──────────────────────────────────────────────
function updateCurrentWeather(data, cityName) {
    const cur = data.current || {};
    const cw  = data.current_weather || {};
    if (locationDisplay) locationDisplay.innerHTML =
        `<i data-lucide="map-pin" style="width:20px;height:20px;"></i> ${cityName}`;
    if (dateDisplay) {
        const t = new Date();
        dateDisplay.textContent =
            `${t.getFullYear()}년 ${String(t.getMonth()+1).padStart(2,"0")}월 ${String(t.getDate()).padStart(2,"0")}일 (${DAYS[t.getDay()]})`;
    }
    const rawTemp = cur.temperature_2m ?? cw.temperature;
    const rawCode = cur.weather_code   ?? cw.weathercode;
    const ci = WEATHER_CODES[rawCode] || { desc:"흐림", icon:"cloud" };
    if (tempDisplay)        tempDisplay.textContent        = safeRound(rawTemp);
    if (weatherDescDisplay) weatherDescDisplay.textContent = ci.desc;
    if (weatherIconMain)    weatherIconMain.innerHTML      =
        `<i data-lucide="${ci.icon}" style="width:90px;height:90px;"></i>`;
    // 습도: current에 없으면 0% 대신 안전하게 '--%' 표시
    const rawHumid = cur.relative_humidity_2m;
    // 풍속: current 에서 wind_speed_10m, 없으면 cw.windspeed (구버전 필드명) 순서로 fallback
    const rawWind  = cur.wind_speed_10m ?? cw.windspeed;

    if (feelsLikeDisplay) feelsLikeDisplay.textContent = `${safeRound(cur.apparent_temperature ?? rawTemp)}°C`;
    if (humidityDisplay)  humidityDisplay.textContent  = rawHumid != null ? `${Math.round(rawHumid)}%` : "--%";
    if (windDisplay)      windDisplay.textContent      = rawWind  != null ? `${parseFloat(rawWind).toFixed(1)} m/s` : "-- m/s";
    const pop = data.hourly?.precipitation_probability?.[new Date().getHours()] ?? 0;
    if (popDisplay) popDisplay.textContent = `${pop}%`;
}

// ─── 시간별 예보 ──────────────────────────────────────────────────────
function updateHourlyForecast(data) {
    if (!hourlyList) return;
    hourlyList.innerHTML = "";
    const h = data.hourly;
    if (!h?.time) { hourlyList.innerHTML="<div class='loading-spinner'>데이터 없음</div>"; return; }
    const start = new Date().getHours();
    for (let i = start; i < start+24; i++) {
        if (!h.time[i]) break;
        const tv  = new Date(h.time[i]);
        const lbl = `${String(tv.getHours()).padStart(2,"0")}:00`;
        const t   = safeRound(h.temperature_2m?.[i]);
        const p   = h.precipitation_probability?.[i] ?? 0;
        const ci  = WEATHER_CODES[h.weather_code?.[i]] || { icon:"cloud" };
        const card = document.createElement("div");
        card.className = "hourly-card";
        card.innerHTML = `
            <span class="hourly-time">${lbl}</span>
            <i data-lucide="${ci.icon}" class="hourly-icon"></i>
            <span class="hourly-temp">${t}°C</span>
            <span class="hourly-pop">
                <i data-lucide="umbrella" style="width:10px;height:10px;stroke:#38bdf8"></i>${p}%
            </span>`;
        hourlyList.appendChild(card);
    }
}

// ─── 주간 예보 ────────────────────────────────────────────────────────
function updateWeeklyForecast(data) {
    if (!weeklyList) return;
    weeklyList.innerHTML = "";
    const d = data.daily;
    if (!d?.time) { weeklyList.innerHTML="<div class='loading-spinner'>데이터 없음</div>"; return; }
    for (let i = 0; i < 7; i++) {
        if (!d.time[i]) break;
        const dv   = new Date(d.time[i]);
        let   day  = DAYS[dv.getDay()];
        if (i===0) day="오늘"; if (i===1) day="내일";
        const maxT = safeRound(d.temperature_2m_max?.[i]);
        const minT = safeRound(d.temperature_2m_min?.[i]);
        const ci   = WEATHER_CODES[d.weather_code?.[i]] || { icon:"cloud", desc:"흐림" };
        const row  = document.createElement("div");
        row.className = "weekly-row";
        row.innerHTML = `
            <span class="weekly-day">${day}</span>
            <div class="weekly-condition">
                <i data-lucide="${ci.icon}" class="weekly-row-icon"></i>
                <span class="weekly-desc-text">${ci.desc}</span>
            </div>
            <div class="weekly-temp-range">
                <span class="weekly-min-temp">${minT}°C</span>
                <span>/</span>
                <span class="weekly-max-temp">${maxT}°C</span>
            </div>`;
        weeklyList.appendChild(row);
    }
}

// ─── 날씨 데이터 메인 호출 ───────────────────────────────────────────
async function fetchWeatherData(lat, lon, cityName="선택 지역") {
    showLoading();
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation,wind_direction_10m` +
            `&hourly=temperature_2m,precipitation_probability,weather_code` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&wind_speed_unit=ms`;
        const res  = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        updateCurrentWeather(data, cityName);
        updateHourlyForecast(data);
        updateWeeklyForecast(data);
        renderAlertCards(data, cityName);       // ← 기상 특보 카드 렌더링
        window.lucide?.createIcons();
    } catch(err) {
        console.error(err);
        alert(`날씨 로드 오류:\n${err.message}`);
    } finally {
        hideLoading();
    }
}

// ─── 한국 주요 도시 고정 좌표 테이블 (검색 시에도 버튼과 동일한 좌표 사용) ─────────
const FIXED_CITY_COORDS = {
    "서울":   { lat:37.5665, lon:126.9780, name:"서울특별시" },
    "부산":   { lat:35.1796, lon:129.0756, name:"부산광역시" },
    "대구":   { lat:35.8714, lon:128.6014, name:"대구광역시" },
    "인천":   { lat:37.4563, lon:126.7052, name:"인천광역시" },
    "광주":   { lat:35.1595, lon:126.8526, name:"광주광역시" },
    "대전":   { lat:36.3504, lon:127.3845, name:"대전광역시" },
    "울산":   { lat:35.5384, lon:129.3114, name:"울산광역시" },
    "강원":   { lat:37.8228, lon:128.1555, name:"강원도" },
    "제주":   { lat:33.4996, lon:126.5312, name:"제주도" }
};

// ─── 도시 검색 ────────────────────────────────────────────────────────
async function searchCity(name) {
    if (!name.trim()) { alert("도시명을 입력해주세요."); return; }
    
    // 한국 주요 도시는 고정 좌표를 사용하여 버튼과 100% 동일한 날씨 결과 출력
    const trimmed = name.trim();
    const fixedKey = Object.keys(FIXED_CITY_COORDS).find(k => trimmed.startsWith(k) || k.startsWith(trimmed));
    if (fixedKey) {
        const fc = FIXED_CITY_COORDS[fixedKey];
        selectCity(fc.lat, fc.lon, fc.name);
        return;
    }

    showLoading();
    try {
        const res  = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=1&language=ko`);
        const data = await res.json();
        if (!data.results?.length) { alert("도시를 찾을 수 없습니다."); return; }
        const r    = data.results[0];
        const city = r.country ? `${r.name}, ${r.country}` : r.name;
        // 검색 시 두 버튼 그룹 모두 해제 후 연동
        cityChips.forEach(c => c.classList.remove("active"));
        regionQuickBtns.forEach(b => b.classList.remove("active"));
        await fetchWeatherData(r.latitude, r.longitude, city);
    } catch(e) { alert(`검색 오류: ${e.message}`); }
    finally    { hideLoading(); }
}

// ─── 역지오코딩: 좌표 → 한국어 주소 (시·구·동) ─────────────────────────────
// BigDataCloud 무료 API 사용 (API 키 불필요, 한국어 지원)
async function getAddressFromCoords(lat, lon) {
    try {
        const res  = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ko`
        );
        const data = await res.json();
        const admins = data.localityInfo?.administrative || [];

        // adminLevel 기준으로 시·구·동 추출
        // 4 = 시/도,  6 = 구/군/시,  8 = 동/읍/면
        const city = admins.find(a => a.adminLevel === 4)?.name || data.city || "";
        const gu   = admins.find(a => a.adminLevel === 6)?.name || "";
        const dong = admins.find(a => a.adminLevel === 8)?.name || data.locality || "";

        // 빈 값 제거 후 공백으로 이어붙이기 → 예) "서울특별시 중구 명동"
        const parts = [city, gu, dong].filter(v => v && v.trim());
        return parts.length > 0 ? parts.join(" ") : "내 위치";
    } catch(e) {
        console.warn("역지오코딩 실패:", e);
        return "내 위치";
    }
}

// ─── 현재 위치 날씨 ──────────────────────────────────────────────────
function getUserLocation() {
    // ① Geolocation 지원 여부 확인
    if (!navigator.geolocation) {
        alert("이 브라우저는 위치 기능을 지원하지 않습니다.\n서울 날씨를 대신 표시합니다.");
        fetchWeatherData(37.5665, 126.9780, "서울");
        return;
    }

    // ② file:// 프로토콜 감지 → Chrome은 file 환경에서 위치 차단
    if (location.protocol === "file:") {
        alert(
            "⚠️ 파일을 직접 열면 위치 기능이 차단됩니다.\n\n" +
            "해결 방법:\n" +
            "VS Code의 'Live Server' 확장을 설치하고\n" +
            "index.html을 우클릭 → 'Open with Live Server'를 선택해 주세요.\n\n" +
            "지금은 서울 날씨를 표시합니다."
        );
        fetchWeatherData(37.5665, 126.9780, "서울");
        return;
    }

    showLoading();
    navigator.geolocation.getCurrentPosition(
        // ③ 성공: 좌표 → 한국어 주소 → 날씨 조회
        async pos => {
            try {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                const locationName = await getAddressFromCoords(lat, lon);
                await fetchWeatherData(lat, lon, locationName);
            } catch(e) {
                console.error("위치 처리 오류:", e);
                hideLoading();
                fetchWeatherData(37.5665, 126.9780, "서울");
            }
        },
        // ④ 실패: 에러 코드별 안내 메시지
        (err) => {
            hideLoading();
            const errMsgs = {
                1: "위치 권한이 거부되었습니다.\n브라우저 주소창 왼쪽 🔒 아이콘 → 위치 → 허용 후 새로고침 해주세요.",
                2: "현재 위치를 가져올 수 없습니다. (GPS/네트워크 오류)\n서울 날씨를 표시합니다.",
                3: "위치 요청 시간이 초과되었습니다.\n서울 날씨를 표시합니다."
            };
            const msg = errMsgs[err.code] || `알 수 없는 오류: ${err.message}`;
            alert(msg);
            // 권한 거부(1)가 아닌 경우에는 서울 날씨로 대체
            if (err.code !== 1) {
                fetchWeatherData(37.5665, 126.9780, "서울");
            }
        },
        // ⑤ 옵션: 15초 타임아웃, 정확도 높게(GPS 우선), 캐시 사용 안 함(항상 최신 위치)
        { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 }
    );
}


// ─── ★ 통합 도시 선택 함수 ───────────────────────────────────────────
// 어디서 선택하든 이 함수 하나로 모든 UI를 한 번에 연동
function selectCity(lat, lon, cityName) {
    // 상단 퀵 버튼 동기화
    cityChips.forEach(c => {
        const match = c.textContent.trim();
        // 도시명이 포함되어 있으면 active
        c.classList.toggle("active", cityName.startsWith(match) || match === cityName);
    });
    // 특보 패널 지역 버튼 동기화
    regionQuickBtns.forEach(b => {
        b.classList.toggle("active",
            b.dataset.region === cityName ||
            cityName.startsWith(b.textContent.trim())
        );
    });
    // 날씨 + 특보 카드 + 시간별 + 주간 전부 갱신
    fetchWeatherData(lat, lon, cityName);
}

// ─── 이벤트 바인딩 ───────────────────────────────────────────────────
// 상단 퀵 도시 버튼
cityChips.forEach(chip => {
    chip.addEventListener("click", () =>
        selectCity(parseFloat(chip.dataset.lat), parseFloat(chip.dataset.lon), chip.textContent.trim())
    );
});

// 특보 패널 지역 선택 버튼
regionQuickBtns.forEach(btn => {
    btn.addEventListener("click", () =>
        selectCity(parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lon), btn.dataset.region)
    );
});

// ─── 챗봇 이벤트 ─────────────────────────────────────────────────────
// 전송 버튼 클릭
chatSendBtn?.addEventListener("click", () => handleChatInput());
// 엔터키 입력
chatInput?.addEventListener("keydown", e => { if (e.key === "Enter") handleChatInput(); });

// ─── 앱 시작 ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
    window.lucide?.createIcons();
    // 서울 날씨 + 특보 카드 + 전국 현황 동시 로드
    await Promise.all([
        fetchWeatherData(37.5665, 126.9780, "서울특별시"),
        fetchAllNationwide(),
    ]);
    window.lucide?.createIcons();
});

// ═══════════════════════════════════════════════════════
// 챗봇 날씨 검색 함수들
// ═══════════════════════════════════════════════════════

// 사용자 말풍선 추가
function appendUserBubble(text) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble user";
    bubble.innerHTML = `
        <div class="bubble-avatar">🧑</div>
        <div class="bubble-content">${text}</div>
    `;
    chatMessages.appendChild(bubble);
    scrollChatToBottom();
}

// 봇 타이핑 애니메이션 표시
function showTypingIndicator() {
    const el = document.createElement("div");
    el.className = "chat-bubble bot typing";
    el.id = "typing-indicator";
    el.innerHTML = `
        <div class="bubble-avatar">🤖</div>
        <div class="bubble-content">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    chatMessages.appendChild(el);
    scrollChatToBottom();
}

// 타이핑 애니메이션 제거
function hideTypingIndicator() {
    document.getElementById("typing-indicator")?.remove();
}

// 기온 및 날씨에 따른 옷차림 추천 텍스트 반환
function getClothingRecommendation(temp, code) {
    let recommendation = "";
    
    // 기온에 따른 분류
    if (temp >= 28) {
        recommendation = "👕 민소매, 반팔 티셔츠, 반바지, 린넨 소재의 옷처럼 아주 시원하고 통풍이 잘되는 가벼운 옷차림이 딱이에요!";
    } else if (temp >= 23) {
        recommendation = "👕 반팔 티셔츠, 얇은 셔츠, 반바지나 얇은 면바지를 추천해요. 실내 에어컨 바람에 대비해 가벼운 겉옷을 챙기셔도 좋습니다.";
    } else if (temp >= 20) {
        recommendation = "👕 얇은 가디건, 긴팔 티셔츠, 셔츠, 면바지나 슬랙스가 어울려요. 낮에는 약간 포근하고 아침저녁으로는 선선한 날씨입니다.";
    } else if (temp >= 17) {
        recommendation = "🧥 얇은 가디건, 니트, 맨투맨, 청바지가 좋아요. 겉옷을 가볍게 걸쳐 기온 변화에 맞춰 조절해 주세요.";
    } else if (temp >= 12) {
        recommendation = "🧥 자켓, 가디건, 셔츠 위에 껴입을 수 있는 니트, 청바지를 권장해요. 본격적으로 쌀쌀함이 느껴지는 계절입니다.";
    } else if (temp >= 9) {
        recommendation = "🧥 트렌치코트, 야상 자켓, 기모 바지가 좋아요. 찬 바람이 몸 속으로 들어오지 않게 따뜻한 겉옷을 입으세요.";
    } else if (temp >= 5) {
        recommendation = "🧣 울 코트, 가죽 자켓, 히트텍 등 내의와 니트를 껴입어 체온을 유지해야 해요. 손발이 시려울 수 있으니 주의하세요.";
    } else {
        recommendation = "❄️ 패딩, 두꺼운 코트, 목도리, 장갑, 기모 제품을 총동원해 무장해 주세요! 영하권이거나 매서운 겨울 추위입니다.";
    }

    // 날씨 상태(비/눈)에 따른 우산/안전 팁 추가
    const isRain = RAINY_CODES.has(code);
    const isSnow = SNOWY_CODES.has(code);

    if (isRain) {
        recommendation += "\n\n☔ 비 소식이 있으니 외출하실 때 튼튼한 우산을 꼭 챙기시고, 젖어도 괜찮은 신발을 선택해 주세요!";
    } else if (isSnow) {
        recommendation += "\n\n☃️ 눈이 내려 길판이 미끄러울 수 있으니 굽이 낮고 마찰력이 좋은 신발을 신고 보행에 주의하세요!";
    }

    return recommendation;
}

// 날씨와 온도에 따른 맞춤 추천 음식 3종 세트 반환
function getFoodRecommendation(temp, code) {
    const isRain = RAINY_CODES.has(code);
    const isSnow = SNOWY_CODES.has(code);

    if (isRain) {
        return [
            { name: "해물파전과 막걸리", desc: "☔ 비 오는 날엔 노릇하게 부친 파전에 막걸리 한 잔이 진리죠!" },
            { name: "칼국수와 수제비", desc: "🍜 빗소리를 들으며 먹는 따뜻하고 걸쭉한 국물이 일품입니다." },
            { name: "삼겹살과 소주", desc: "🥓 비 오는 우중충한 날, 지글지글 굽는 고기 냄새는 참을 수 없죠." }
        ];
    }
    if (isSnow) {
        return [
            { name: "얼큰한 부대찌개", desc: "☃️ 하얗게 눈 내리는 날, 햄과 소시지 가득한 보글보글 찌개가 제격입니다." },
            { name: "뼈다귀 감자탕", desc: "🍲 든든한 뼈해장국이나 감자탕으로 속을 따뜻하게 데워보세요." },
            { name: "어묵탕과 사케/도쿠리", desc: "🍢 모락모락 김이 피어오르는 뜨끈한 어묵국물에 온사케 한 잔!" }
        ];
    }
    if (temp >= 28) {
        return [
            { name: "물냉면/비빔냉면", desc: "☀️ 땀이 뻘뻘 나는 무더위엔 살얼음 동동 띄운 냉면이 1순위입니다!" },
            { name: "이열치열 삼계탕", desc: "🐔 땀 흘려 허해진 몸을 채워줄 든든한 삼계탕 보양식입니다." },
            { name: "시원한 콩국수", desc: "🥣 걸쭉하고 고소한 국물에 얼음 띄운 콩국수로 더위를 달래보세요." }
        ];
    }
    if (temp <= 9) {
        return [
            { name: "따뜻한 순대국밥", desc: "🥶 으스스 찬 바람 불 때는 역시 뚝배기에 펄펄 끓는 국밥이 최고입니다." },
            { name: "불맛 가득한 짬뽕", desc: "🍜 매콤하고 칼칼한 짬뽕 국물 한 모금으로 한기를 싹 날려보세요." },
            { name: "소곱창전골", desc: "🥘 추운 저녁, 든든하고 진한 곱창 전골 요리를 강력 추천합니다." }
        ];
    }
    
    // 일반적인 봄/가을 선선한 날씨
    return [
        { name: "모듬초밥", desc: "🌤️ 나들이 가기 좋은 쾌적한 날씨, 정갈하고 맛있는 스시 어떠신가요?" },
        { name: "이탈리안 파스타", desc: "🍝 선선한 바람과 함께 어울리는 분위기 좋은 레스토랑의 스파게티입니다." },
        { name: "매콤한 제육볶음", desc: "🥩 든든하고 입맛을 돋우는 밥도둑 제육볶음 쌈밥을 제안합니다." }
    ];
}

// 봇 날씨 응답 말풍선 추가
function appendBotWeatherBubble(cityName, data) {
    const cur  = data.current || {};
    const cw   = data.current_weather || {};
    const temp = Math.round(cur.temperature_2m ?? cw.temperature ?? 0);
    const code = cur.weather_code ?? cw.weathercode ?? 0;
    const ci   = WEATHER_CODES[code] || { desc: "흐림", icon: "cloud" };
    const feels = Math.round(cur.apparent_temperature ?? temp);
    const humid = cur.relative_humidity_2m != null ? `${Math.round(cur.relative_humidity_2m)}%` : "--%";
    const wind  = (cur.wind_speed_10m ?? cw.windspeed) != null
        ? `${parseFloat(cur.wind_speed_10m ?? cw.windspeed).toFixed(1)} m/s` : "-- m/s";
    const pop   = data.hourly?.precipitation_probability?.[new Date().getHours()] ?? 0;

    // 옷차림 추천 멘트 가져오기
    const clothingAdvice = getClothingRecommendation(temp, code);
    
    // 음식 추천 정보 가져오기 (3종 배열)
    const foodList = getFoodRecommendation(temp, code);

    // 날씨 이모지 매핑
    const weatherEmoji = {
        "sun": "☀️", "cloud-sun": "🌤️", "cloud": "☁️",
        "cloud-fog": "🌫️", "cloud-drizzle": "🌦️", "cloud-rain": "🌧️",
        "snowflake": "❄️", "cloud-lightning-rain": "⛈️", "cloud-lightning": "🌩️"
    }[ci.icon] || "🌤️";

    // 3가지 음식 항목 각각의 지도 검색 링크 생성
    let foodHtml = "";
    foodList.forEach(food => {
        const encodedQuery = encodeURIComponent(`${cityName} ${food.name}`);
        const mapUrl = `https://map.kakao.com/?q=${encodedQuery}`;
        foodHtml += `
            <div class="food-item-card">
                <div class="food-item-name">📌 <strong>${food.name}</strong></div>
                <p class="food-item-desc">${food.desc}</p>
                <a href="${mapUrl}" target="_blank" class="food-map-btn">
                    <i data-lucide="map-pin" style="width:12px;height:12px;margin-right:4px;"></i> 지도에서 맛집 찾기 🗺️
                </a>
            </div>
        `;
    });

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble bot";
    bubble.innerHTML = `
        <div class="bubble-avatar">🤖</div>
        <div class="bubble-content">
            <p class="bubble-city-name">${weatherEmoji} ${cityName} 현재 날씨</p>
            <div class="bubble-weather-info">
                <div class="bubble-weather-row"><span>🌡 온도</span><strong>${temp}°C</strong></div>
                <div class="bubble-weather-row"><span>🤔 체감</span><strong>${feels}°C</strong></div>
                <div class="bubble-weather-row"><span>💧 습도</span><strong>${humid}</strong></div>
                <div class="bubble-weather-row"><span>💨 풍속</span><strong>${wind}</strong></div>
                <div class="bubble-weather-row"><span>☔ 강수</span><strong>${pop}%</strong></div>
                <div class="bubble-weather-row"><span>📋 상태</span><strong>${ci.desc}</strong></div>
            </div>
            <!-- 옷차림 추천 영역 -->
            <div class="bubble-clothing-info">
                <div class="clothing-header">👗 추천 옷차림 가이드</div>
                <div class="clothing-text">${clothingAdvice.replace(/\n/g, "<br>")}</div>
            </div>
            <!-- 음식 및 맛집 추천 영역 -->
            <div class="bubble-food-info">
                <div class="food-header">🍴 오늘의 날씨 맞춤 추천 푸드 (3가지)</div>
                <div class="food-list-wrapper">
                    ${foodHtml}
                </div>
            </div>
        </div>
    `;
    chatMessages.appendChild(bubble);
    scrollChatToBottom();
    // 대화가 20개 넘으면 오래된 것 삭제 (첫 인사 메시지 제외)
    const bubbles = chatMessages.querySelectorAll(".chat-bubble");
    if (bubbles.length > 22) bubbles[1].remove();
}

// 봇 오류 말풍선
function appendBotErrorBubble(msg) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble bot";
    bubble.innerHTML = `
        <div class="bubble-avatar">🤖</div>
        <div class="bubble-content">
            <p>😔 ${msg}</p>
            <p class="bubble-hint">다른 도시명을 입력해 보세요. 예) 서울, 부산, Tokyo</p>
        </div>
    `;
    chatMessages.appendChild(bubble);
    scrollChatToBottom();
}

// 채팅창 맨 아래로 스크롤
function scrollChatToBottom() {
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ─── 챗봇 입력 처리 메인 함수 ────────────────────────────────────────
async function handleChatInput() {
    const raw = chatInput?.value?.trim();
    if (!raw) return;

    // 1. 사용자 말풍선 출력 & 입력창 초기화
    appendUserBubble(raw);
    chatInput.value = "";

    // 2. 타이핑 애니메이션
    showTypingIndicator();

    try {
        // 3. 고정 좌표 도시인지 먼저 확인
        const trimmed = raw.trim();
        const fixedKey = Object.keys(FIXED_CITY_COORDS).find(
            k => trimmed.startsWith(k) || k.startsWith(trimmed)
        );

        let lat, lon, cityName;
        if (fixedKey) {
            // 고정 도시 사용
            ({ lat, lon, name: cityName } = FIXED_CITY_COORDS[fixedKey]);
        } else {
            // 상세 주소(시, 군, 구, 동) 대응을 위한 Nominatim API 검색 (User-Agent 정보와 한국어 결과 요청 포함)
            const searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=1&accept-language=ko`;
            const res = await fetch(searchUrl, {
                headers: {
                    "User-Agent": "SkyFlowWeatherApp/1.0"
                }
            });
            const geoData = await res.json();
            
            if (!geoData || geoData.length === 0) {
                // Nominatim에서 찾지 못한 경우 기존 Open-Meteo Geocoding을 fallback으로 시도
                const fallbackRes = await fetch(
                    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=1&language=ko`
                );
                const fallbackData = await fallbackRes.json();
                if (!fallbackData.results?.length) {
                    hideTypingIndicator();
                    appendBotErrorBubble(`"${raw}"를 찾을 수 없습니다.`);
                    return;
                }
                const r = fallbackData.results[0];
                lat = r.latitude;
                lon = r.longitude;
                cityName = r.name || trimmed;
            } else {
                const r = geoData[0];
                lat = parseFloat(r.lat);
                lon = parseFloat(r.lon);
                
                // Nominatim의 display_name은 복잡하므로, 쉼표로 분할하여 가장 앞의 주소 명칭(예: 역삼동, 강남구)을 도시명으로 사용
                const nameParts = r.display_name.split(",");
                cityName = nameParts[0].trim();
            }
        }

        // 4. 날씨 API 호출
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation,wind_direction_10m` +
            `&hourly=temperature_2m,precipitation_probability,weather_code` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&wind_speed_unit=ms`;
        const weatherRes  = await fetch(url);
        const weatherData = await weatherRes.json();

        // 5. 타이핑 제거 후 날씨 말풍선 출력
        hideTypingIndicator();
        appendBotWeatherBubble(cityName, weatherData);

        // 6. 메인 카드 + 예보 패널도 함께 갱신
        selectCity(lat, lon, cityName);

    } catch(e) {
        hideTypingIndicator();
        appendBotErrorBubble("날씨 정보를 가져오는 중 오류가 발생했습니다.");
        console.error(e);
    }
}
