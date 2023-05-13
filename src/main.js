import Vue from 'vue';
import App from './pages/index/App.vue';

Vue.config.productionTip = true;

new Vue({
    render: h => h(App)
}).$mount('#app');
