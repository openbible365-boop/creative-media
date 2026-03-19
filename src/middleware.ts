import { withAuth } from "next-auth/middleware";

// 保护需要登录的路由
export default withAuth({
  pages: {
    signIn: "/dashboard", // 未登录重定向到 dashboard（dashboard 页面自带登录按钮）
  },
});

export const config = {
  // 仅保护以下路由，API routes 和静态资源不受影响
  matcher: ["/projects/:path*"],
};
