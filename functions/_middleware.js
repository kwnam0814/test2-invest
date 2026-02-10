// functions/_middleware.js

// 💡 IP 허용 목록: 여기에 접속을 허용할 IP 주소를 추가하세요.
// 예: const allowedIps = ["11.22.33.44", "55.66.77.88"];
// 지금은 테스트를 위해 모든 IP(*)를 허용하도록 설정되어 있습니다. 실제 운영 시에는 반드시 특정 IP로 변경하세요.
const allowedIps = ["*"];

/**
 * 모든 요청을 가로채는 미들웨어 함수
 * @param {EventContext<Env, Params, Data>} context
 */
export async function onRequest(context) {
  // 환경 변수에서 IP 목록을 가져오거나(쉼표로 구분), 코드에 직접 정의된 목록을 사용합니다.
  // Cloudflare 대시보드 > 설정 > 환경 변수에서 'ALLOWED_IPS'를 설정하는 것을 권장합니다.
  const ipList = context.env.ALLOWED_IPS ? context.env.ALLOWED_IPS.split(',').map(ip => ip.trim()) : allowedIps;

  // 와일드카드('*')가 포함되어 있으면 모든 IP를 허용합니다.
  if (ipList.includes('*')) {
    // 다음 함수 또는 정적 에셋으로 요청을 넘깁니다.
    return await context.next();
  }

  // Cloudflare를 통해 접속한 실제 사용자의 IP 주소를 가져옵니다.
  const clientIp = context.request.headers.get('CF-Connecting-IP');

  // 허용된 IP 목록에 요청자 IP가 있는지 확인합니다.
  if (clientIp && ipList.includes(clientIp)) {
    // 허용된 IP인 경우, 요청을 계속 진행합니다.
    return await context.next();
  } else {
    // 허용되지 않은 IP인 경우, 접근 거부 메시지를 반환합니다.
    return new Response(`Access Denied: Your IP address (${clientIp}) is not allowed to access this service.`, { status: 403 });
  }
}
