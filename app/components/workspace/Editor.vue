<template>
  <div>
    <h1>{{ msg }}</h1>
    <div class="writing-container" touch-action="none" ref="editor"></div>
  </div>
</template>

<script>
import iink from 'iink-js'

export default {
  name: 'Editor',
  data() {
    return {
      msg: 'Basic example of vue integration of iinkJS'
    }
  },
  mounted() {
    this.editor = iink.register(this.$refs.editor, {
      recognitionParams: {
        type: 'MATH',
        protocol: 'WEBSOCKET',
        apiVersion: 'V4',
        server: {
          scheme: 'https',
          host: 'webdemoapi.myscript.com',
          applicationKey: '14ed1545-58a5-42b3-b190-638032a64221',
          hmacKey: '6aa27c72-082a-49d1-a246-ef841339a3ba'
        }
      }
    })
  },
  destroyed() {
    // don't forget to close websocket when not need it anymore
    this.editor.close()
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style>
/* h1,
h2 {
  font-weight: normal;
}

ul {
  list-style-type: none;
  padding: 0;
}

li {
  display: inline-block;
  margin: 0 10px;
}

a {
  color: #42b983;
} */

.writing-container {
  min-height: 600px;
  min-width: 300px;
}
</style>