// ============================================================
// config.js - Supabase 버전
// ============================================================
//
// ★ Supabase 설정
//   아래 두 값만 실제 값으로 교체하세요.
//   SUPABASE_URL  → Supabase 프로젝트 Settings > API > Project URL
//   SUPABASE_ANON → Supabase 프로젝트 Settings > API > anon public key
//
// ============================================================

const AppConfig = {

  // ── Supabase 연결 정보 ─────────────────────────────────────
  SUPABASE_URL:  'https://ipfhpplufjdagfadgskb.supabase.co',
  SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwZmhwcGx1ZmpkYWdmYWRnc2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NDY0ODAsImV4cCI6MjA5ODQyMjQ4MH0.wOgnMxpVz9wOsf2OPBSix9pNbpl141di03uaplKUBKM',

  // ── 테이블명 ───────────────────────────────────────────────
  TABLES: {
    USERS:               'users',
    CLIENTS:             '고객_Master',
    ASSESS_MASTER:       '평가_Master',
    COGNITIVE:           '인지_실비아',
    MOVEMENT_ERGO:       '움직임_에르고미터',
    MOVEMENT_EVEREX:     '움직임_에버엑스',
    MOVEMENT_INBODY_FRA: '움직임_인바디FRA',
    METABOLISM_INBODY:   '대사_인바디',
    METABOLISM_STRESS:   '대사_스트레스',
    COMMENT:             '코멘트',
    STANDARDS:           '기준값_관리'
  },

  // ── 컬럼명 (수퍼베이스 DB 실제 컬럼명) ─────────────────────
  USER_COLS: {
    USER_ID:    'user_id',
    LOGIN_ID:   'login_id',
    PASSWORD:   'password',
    NAME:       'name',
    ROLE:       'role',
    STATUS:     'status',
    CREATED_AT: 'created_at',
    LAST_LOGIN: 'last_login'
  },

  CLIENT_COLS: {
    CLIENT_ID:    '고객_ID',
    NAME:         '고객명',
    BIRTH_DATE:   '생년월일',
    GENDER:       '성별',
    PHONE:        '휴대전화번호',
    FIRST_VISIT:  '최초_내원일',
    ADMIT_DATE:   '입소일자',
    ADMIT_PERIOD: '입소기간',
    END_DATE:     '종료_예정일',
    TOTAL_ROUNDS: '총_회차수',
    DONE_ROUNDS:  '완료_회차수',
    STATUS:       '상태',
    ROOM_NUM:     '입실호수',
    NOTE:         '비고'
  },

  COG_COLS: {
    ASSESS_ID:      '평가_ID',
    CLIENT_ID:      '고객_ID',
    MEASURE_DATE:   '측정일',
    ROUND:          '회차',
    COG_SCORE:      '인지점수',
    SPATIAL:        '시공간능력',
    MEMORY:         '기억력',
    AGE_PERCENTILE: '동연령대 상위 분포도',
    DEPRESSION:     '우울점수',
    DEMENTIA_RISK:  '치매위험요인',
    CREATED_AT:     '등록일시'
  },

  ERGO_COLS: {
    ASSESS_ID:    '평가_ID',
    CLIENT_ID:    '고객_ID',
    MEASURE_DATE: '측정일',
    ROUND:        '회차',
    CARDIO_SCORE: '심폐기능지수',
    CARDIO_INDEX: 'VO2peak 등급',
    CREATED_AT:   '등록일시'
  },

  EVEREX_COLS: {
    ASSESS_ID:           '평가_ID',
    CLIENT_ID:           '고객_ID',
    MEASURE_DATE:        '측정일',
    ROUND:               '회차',
    BODY_MOVEMENT_INDEX: '신체 움직임 점수',
    CREATED_AT:          '등록일시'
  },

  FRA_COLS: {
    ASSESS_ID:     '평가_ID',
    CLIENT_ID:     '고객_ID',
    MEASURE_DATE:  '측정일',
    ROUND:         '회차',
    NERVOUS_SCORE: '신경계 점수',
    BALANCE_SCORE: '통합 균형능력 점수',
    SENSORY_SCORE: '감각계 점수',
    CREATED_AT:    '등록일시'
  },

  INBODY_COLS: {
    ASSESS_ID:       '평가_ID',
    CLIENT_ID:       '고객_ID',
    MEASURE_DATE:    '측정일',
    ROUND:           '회차',
    BODY_COMP_SCORE: '체성분 종합 점수',
    CREATED_AT:      '등록일시'
  },

  STRESS_COLS: {
    ASSESS_ID:    '평가_ID',
    CLIENT_ID:    '고객_ID',
    MEASURE_DATE: '측정일',
    ROUND:        '회차',
    STRESS_SCORE: '스트레스 점수',
    CREATED_AT:   '등록일시'
  },

  COMMENT_COLS: {
    COMMENT_ID:  '코멘트_ID',
    CLIENT_ID:   '고객_ID',
    ROUND:       '회차',
    COG_COMMENT: '인지 전문가 코멘트',
    COG_UPDATED: '인지 수정일',
    EX_COMMENT:  '운동 전문가 코멘트',
    EX_UPDATED:  '운동 수정일',
    CM_COMMENT:  '케어 매니저 코멘트',
    CM_UPDATED:  'CM 수정일',
    UPDATED_AT:  '최종수정일'
  },

  MASTER_COLS: {
    REPORT_ID:           '리포트_ID',
    CLIENT_ID:           '고객_ID',
    ROUND:               '회차',
    COG_SCORE:           '인지점수',
    AGE_PERCENTILE:      '동연령대 상위 분포도',
    DEPRESSION:          '우울점수',
    DEMENTIA_RISK:       '치매위험요인',
    CARDIO_SCORE:        '심폐기능 점수',
    CARDIO_INDEX:        '심폐 기능 지수',
    BODY_MOVEMENT_INDEX: '신체 움직임 지수',
    NERVOUS_SCORE:       '신경계 점수',
    BALANCE_SCORE:       '통합 균형능력 점수',
    SENSORY_SCORE:       '감각계 점수',
    BODY_COMP_SCORE:     '체성분 종합 점수',
    STRESS_SCORE:        '스트레스 점수',
    COG_COMMENT:         '인지 전문가 코멘트',
    EX_COMMENT:          '운동 전문가 코멘트',
    CM_COMMENT:          '케어 매니저 코멘트',
    COGNITIVE_DONE:      '인지평가완료',
    MOVEMENT_DONE:       '움직임평가완료',
    METABOLISM_DONE:     '대사평가완료',
    COMMENT_DONE:        '코멘트완료',
    CREATED_AT:          '생성일',
    ASSESS_DATE:         'assessDate',
    REPORT_CREATED_AT:   'reportCreatedAt',
    REPORT_GENERATED:    '통합리포트생성여부'
  },

  STANDARDS_COLS: {
    CATEGORY:   'category',
    KEY:        'key',
    LABEL:      'label',
    ORDER:      'order',
    UPDATED_AT: 'updatedAt'
  },

  // ── 앱 공통 설정 ───────────────────────────────────────────
  ROLES: {
    ADMIN:'전체 관리자', CARE_MANAGER:'케어 매니저',
    COGNITIVE_SPECIALIST:'인지 전문가', EXERCISE_SPECIALIST:'운동 전문가'
  },
  STATUS: { ACTIVE:'사용', INACTIVE:'미사용' },
  CLIENT_STATUS: { SCHEDULED:'입소예정', ADMITTED:'입소중', DISCHARGED:'퇴소' },
  PERIOD_ROUNDS: { '2주':1,'1개월':2,'2개월':3,'3개월':4,'4개월':5,'5개월':6,'6개월':7 },
  PERIOD_DAYS:   { '2주':14,'1개월':28,'2개월':56,'3개월':84,'4개월':112,'5개월':140,'6개월':168 },
  STORAGE_KEY: 'carehub_user',
  DEFAULT_PASSWORD: 'carehub1234!',

  ASSESS_CATEGORIES: [
    { id:'cognitive', label:'인지평가', icon:'🧠' },
    { id:'movement',  label:'움직임평가', icon:'🏃' },
    { id:'metabolism',label:'대사평가', icon:'💊' },
    { id:'comment',   label:'코멘트', icon:'💬' }
  ],
  ASSESS_WRITE_ROLES: {
    cognitive:  ['ADMIN','CARE_MANAGER','COGNITIVE_SPECIALIST'],
    movement:   ['ADMIN','CARE_MANAGER','EXERCISE_SPECIALIST'],
    metabolism: ['ADMIN','CARE_MANAGER'],
    comment:    ['ADMIN','CARE_MANAGER','COGNITIVE_SPECIALIST','EXERCISE_SPECIALIST']
  },
  VO2PEAK_MALE: {
    '60-65': [
      { label:'최우수 (Superior)',  min:40.0, max:Infinity },
      { label:'우수 (Excellent)',   min:36.0, max:39.9 },
      { label:'평균 이상 (Good)',   min:32.0, max:35.9 },
      { label:'평균 (Fair)',        min:29.0, max:31.9 },
      { label:'평균 이하 (Poor)',   min:25.0, max:28.9 },
      { label:'최하위 (Very Poor)', min:-Infinity, max:24.9 }
    ],
    '66+': [
      { label:'최우수 (Superior)',  min:37.0, max:Infinity },
      { label:'우수 (Excellent)',   min:33.0, max:37.0 },
      { label:'평균 이상 (Good)',   min:29.0, max:32.9 },
      { label:'평균 (Fair)',        min:26.0, max:28.9 },
      { label:'평균 이하 (Poor)',   min:22.0, max:25.9 },
      { label:'최하위 (Very Poor)', min:-Infinity, max:21.9 }
    ]
  },
  VO2PEAK_FEMALE: {
    '60-65': [
      { label:'최우수 (Superior)',  min:33.0, max:Infinity },
      { label:'우수 (Excellent)',   min:29.0, max:32.9 },
      { label:'평균 이상 (Good)',   min:25.0, max:28.9 },
      { label:'평균 (Fair)',        min:22.0, max:24.9 },
      { label:'평균 이하 (Poor)',   min:19.0, max:21.9 },
      { label:'최하위 (Very Poor)', min:-Infinity, max:18.9 }
    ],
    '66+': [
      { label:'최우수 (Superior)',  min:32.0, max:Infinity },
      { label:'우수 (Excellent)',   min:28.0, max:32.0 },
      { label:'평균 이상 (Good)',   min:25.0, max:27.9 },
      { label:'평균 (Fair)',        min:22.0, max:24.9 },
      { label:'평균 이하 (Poor)',   min:19.0, max:21.9 },
      { label:'최하위 (Very Poor)', min:-Infinity, max:18.9 }
    ]
  },
  COGNITIVE_GRADE: [
    { label:'최적', min:90,  max:Infinity, color:'#1B5E20' },
    { label:'양호', min:80,  max:89.9,     color:'#2E7D32' },
    { label:'개선', min:65,  max:79.9,     color:'#F57F17' },
    { label:'주의', min:-Infinity, max:64.9, color:'#C62828' }
  ],
  STRESS_GRADE: [
    { label:'정상', min:-Infinity, max:34.9, color:'#2E7D32', bg:'#E8F5E9' },
    { label:'초기', min:35, max:44.9, color:'#F57F17', bg:'#FFF8E1' },
    { label:'진행', min:45, max:59.9, color:'#E65100', bg:'#FBE9E7' },
    { label:'만성', min:60, max:Infinity, color:'#C62828', bg:'#FFEBEE' }
  ],

  MENUS: [
    {
      id:'dashboard', label:'대시보드',
      icon:`<svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`,
      roles:['ADMIN','CARE_MANAGER','COGNITIVE_SPECIALIST','EXERCISE_SPECIALIST']
    },
    {
      id:'clients', label:'고객 관리',
      icon:`<svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
      roles:['ADMIN','CARE_MANAGER','COGNITIVE_SPECIALIST','EXERCISE_SPECIALIST']
    },
    {
      id:'reports', label:'리포트 관리',
      icon:`<svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
      roles:['ADMIN','CARE_MANAGER','COGNITIVE_SPECIALIST','EXERCISE_SPECIALIST']
    },
    {
      id:'assessments', label:'평가 관리',
      icon:`<svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`,
      roles:['ADMIN','CARE_MANAGER','COGNITIVE_SPECIALIST','EXERCISE_SPECIALIST']
    },
    {
      id:'admin-group', label:'관리자', type:'group',
      icon:`<svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
      roles:['ADMIN']
    },
    {
      id:'admin-users', label:'사용자 관리', parent:'admin-group',
      icon:`<svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
      roles:['ADMIN']
    },
    {
      id:'admin-standards', label:'기준값 관리', parent:'admin-group',
      icon:`<svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>`,
      roles:['ADMIN']
    }
  ]
};
