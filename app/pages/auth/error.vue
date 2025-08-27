<template>
   <div>
     <h1>Authentication Error</h1>
     <p>{{ errorMessage }}</p>
   </div>
 </template>
 
 <script setup>
 import { useRoute } from 'vue-router';
 
 const route = useRoute();
 const errorMessages = {
   UserNotFound: 'No account found with this email.',
   InvalidPassword: 'Incorrect password. Please try again.',
   EmailNotVerified: 'Your email is not verified. Please verify your account.',
   PasswordNotSet: 'You need to set a password for your account.',
   default: 'An unexpected error occurred. Please try again later.',
 };
 
 const errorMessage = errorMessages[route.query.error] || errorMessages.default;
 </script>
