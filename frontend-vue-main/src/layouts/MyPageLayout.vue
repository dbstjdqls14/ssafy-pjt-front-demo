<script setup>
import MyPageNav from '../components/mypage/MyPageNav.vue'
</script>

<template>
  <main class="page-shell wide mypage-shell">
    <header class="page-head mypage-page-head">
      <h1>마이페이지</h1>
    </header>

    <div class="mypage-layout">
      <!-- 헤더·푸터·좌측 네비는 고정. 탭 전환 시 우측 패널만 부드럽게 교체된다. -->
      <MyPageNav />

      <!-- 자식 라우트(패널)만 교체된다. 트랜지션의 leave 완료를 기다리지 않도록
           <Transition> 대신 패널 자체의 CSS enter 애니메이션(.mypage-panel)으로
           부드럽게 나타나게 한다 — 앱 전역 .route-view 방식과 동일하고 멈춤이 없다. -->
      <RouterView />
    </div>
  </main>
</template>
