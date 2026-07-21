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
const citySearch         = document.getElementById("city-search");
const searchBtn          = document.getElementById("search-btn");
const geoBtn             = document.getElementById("geo-btn");
const loadingOverlay     = document.getElementById("loading-overlay");
const cityChips          = document.querySelectorAll(".city-chip");
const alertCardsGrid     = document.getElementById("alert-cards-grid");
const alertRegionDisplay = document.getElementById("alert-region-display");
const nationwideGrid     = document.getElementById("nationwide-grid");
const regionQuickBtns    = document.querySelectorAll(".region-btn");

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

// ─── 현재 위치 날씨 ──────────────────────────────────────────────────
function getUserLocation() {
    if (!navigator.geolocation) { fetchWeatherData(37.5665,126.9780,"서울"); return; }
    showLoading();
    navigator.geolocation.getCurrentPosition(
        async pos => { await fetchWeatherData(pos.coords.latitude, pos.coords.longitude, "내 위치"); },
        ()        => { hideLoading(); fetchWeatherData(37.5665,126.9780,"서울"); },
        { timeout:4000 }
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

searchBtn?.addEventListener("click", () => searchCity(citySearch.value));
citySearch?.addEventListener("keydown", e => { if(e.key==="Enter") searchCity(citySearch.value); });
geoBtn?.addEventListener("click", () => {
    cityChips.forEach(c => c.classList.remove("active"));
    regionQuickBtns.forEach(b => b.classList.remove("active"));
    getUserLocation();
});

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
