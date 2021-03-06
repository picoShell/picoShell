const React = require('react');
const axios = require('axios');

class CodeEditor extends React.Component {
  constructor(props) {
    super(props);
    var context = this;
    let obj;

    if (localStorage[window.location]) {
       obj = JSON.parse(localStorage[window.location]);      
    } else {
       obj = {};
    }

    this.state = {
      codeValue: '',
      containerName: this.props.containerName,
      username: this.props.username,
      fileName: obj.fileName || '',
      filePath: obj.filePath || '',
      codeSaved: true,
      permissions: this.props.permissions
    }
    this.recievedCEChange = this.recievedCEChange.bind(this);
    this.username = JSON.parse(localStorage['user']).username;
    this.handleFileRun = this.handleFileRun.bind(this);
    this.handleCodeSave = this.handleCodeSave.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    const context = this;

    this.socket.off('/TE/' + this.state.containerName);
    this.socket.off('/TE/JOIN/' + this.state.containerName);
    if(nextProps.containerName === this.state.username) {
      this.setState({
        fileName: this.state.fileName,
        filePath: this.state.filePath,
        codeValue: this.state.codeValue
      });
    } else {
      this.setState({
        containerName: nextProps.containerName,
        fileName: '',
        filePath: '',
        codeValue: '',
        permissions: nextProps.permissions
      });

      this.editor.getDoc().setValue('');
      this.socket.emit('/TE/JOIN/', {containerName: nextProps.containerName, username: this.username});
    }
    
    this.socket.on('/TE/' + nextProps.containerName, function(code) {
      context.recievedCEChange(code);
    });
    this.socket.on('/TE/JOIN/' + nextProps.containerName, function(code) {
      if(context.username !== code.username) {
        var code = document.getElementById('code-editor').value;
        context.socket.emit('/TE/', {join: true, code: code, username: context.username, containerName: nextProps.containerName, fileName: context.state.fileName, filePath: context.state.filePath});
      }
    });



  }

  recievedCEChange(code) {
    const fileName = code.fileName;
    const filePath = code.filePath;
    const codeValue = code.code;
    const vim = code.vim;

    const type = fileName.split(".").pop();
    let mode;
    let keyMap;

    if (type === 'js') {
      mode = 'javascript';
    } else if (type === 'py' || type === "pyo" || type === "pyc" || type === "pyd") {
      mode = 'python';
    } else if (type === 'rb' || fileName === "Gemfile" || type === "ru") {
      mode = 'ruby';
    } else if (type === 'jsx') {
      mode = 'jsx';
    } else if (type === 'erb') {
      mode = 'application/x-erb'
    } else if (type === 'erb') {
      mode = 'application/x-ejs'
    } else if (type === 'aspx') {
      mode = 'application/x-aspx'
    } else if (type === 'jsp') {
      mode = 'application/x-jsp'
    } else if (type === 'css') {
      mode = 'text/css';
    } else if (type === 'scss') {
      mode = 'text/x-scss';
    } else if (type === 'gss') {
      mode = 'text/x-gss';
    } else if (type === 'less') {
      mode = 'text/x-less';
    } else if (type === 'md') {
      mode = 'gfm';
    }


    // } else if (type === 'c' || type === 'h' || type === 'cc'|| type === 'C' || type === 'cpp' || type === 'CPP' || type === 'c++' || type === 'cp' || type === 'cxx') {
    //   mode = 'cli'
    // }

    this.editor.setOption("mode", mode);


    console.log(this.editor);

    if(code.fileOpen) {
      this.setState({
        codeSaved: true
      });
    } else {
      this.setState({
        codeSaved: false
      });
    }
    if(code.fileOpen || code.username !== this.username) {
      this.setState({
        codeValue: codeValue,
        fileName: fileName,
        filePath: filePath
      });

      if (vim) {
        keyMap = 'vim';
        const context = this;
        CodeMirror.commands.save = function () {
          context.handleCodeSave();
        };
      }


      this.editor.setOption("keyMap", keyMap);
      //Must place the cursor back where it was after replacing contents. Otherwise weird things happen.
      this.cursorPos = this.editor.doc.getCursor();
      this.editor.getDoc().setValue(code.code);

      this.editor.doc.setCursor(this.cursorPos);

    }
  }

  
  componentDidMount() {
    $(".code-editor-container").resizable({
      handleSelector: ".splitter",
      resizeHeight: false
    });
    const context = this;
    var codeEditor = document.getElementById("code-editor")


    var editor = CodeMirror.fromTextArea(codeEditor, {
      lineNumbers: true,
      theme: 'monokai',
      styleActiveLine: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      lineWrapping: true,
      scrollbarStyle: "overlay",
      indent: true,
    });

    editor.on('changes', function(editor, e){
      if(Date.now() - context.lastUpdate < 100) {
        return;
      }
      var code = editor.getValue();
      var textArea = document.getElementById("code-editor");
      textArea.value = code;
      //Need this to prevent an infinite loop. Calling .getDoc().setValue() triggers 'changes'
      if(context.state.codeValue !== code)
      {
        context.handleCodeChange();
      }
    });

    //this keeps indentation during a word wrap
    var charWidth = editor.defaultCharWidth(), basePadding = 1;
    editor.on("renderLine", function(cm, line, elt) {
      var off = CodeMirror.countColumn(line.text, null, cm.getOption("tabSize")) * charWidth;
      elt.style.textIndent = "-" + off + "px";
      elt.style.paddingLeft = (basePadding + off) + "px";
    });
    editor.refresh();


    this.editor = editor;
    this.lastUpdate = Date.now();
    this.socket.emit('/TE/JOIN/', {containerName: this.state.containerName, username: this.username});


  }

  componentWillMount() {
    this.socket = io();
    const context = this;

    this.socket.on('/TE/' + this.props.containerName, function(code) {
      context.recievedCEChange(code);
    });
  }

  handleFileRun() {
    const context = this;
    if(!this.state.fileName) {
      alert('Please select a file before attempting to run.');
    } else {
      axios.post('/docker/executeFile', {code: document.getElementById('code-editor').value, containerName: this.state.containerName, fileName: this.state.fileName, filePath: this.state.filePath})
      .then(function(resp) {
        const exResponse = resp.data.res;
        var filePath = context.state.filePath.endsWith('/') ? context.state.filePath + context.state.fileName : context.state.filePath + '/' + context.state.fileName;
        context.socket.emit('/TERM/RES/', {cmd: resp.data.cmd + ' ' + filePath, res: exResponse, username: 'FILEBROWSER', containerName: context.state.containerName});
        context.setState({
          codeSaved: true
        });
      })
      .catch(function(err) {
        alert(err.response.data.msg);
      });
    }
  }

  handleOnKeyDown(e) {
    const context = this;
    if(context.state.permissions === 'read') {
      e.preventDefault();
      return;
    }

    if((e.ctrlKey && e.key === 'Enter') || (e.metaKey && e.key === 'Enter')) {
      this.handleFileRun();
    }

    if(!e.metaKey && !e.shiftKey && !e.altKey && !e.ctrlKey) {
      this.setState({ codeSaved: false });
    }

    if((e.metaKey && e.key === 's') || (e.ctrlKey && e.key === 's')) {
      e.preventDefault();
      this.handleCodeSave(e);
    }

    if(e.key === 'Backspace') {
      if(document.getElementById('code-editor').value.length === 0) {
        this.handleCodeChange(true);
      }
    }
  }

  handleCodeChange(sendBlank) {
    var code = document.getElementById('code-editor').value;
    if(code !== '' || sendBlank) {
      this.socket.emit('/TE/', {code: code, username: this.username, containerName: this.state.containerName, fileName: this.state.fileName, filePath: this.state.filePath});
    }

    if (window.location.pathname.split("/")[1] === "video") {
      // console.log('tried to save video');
      this.handleCodeSaveIfVideo();
    }
  }

  handleCodeSaveIfVideo() {
    const key = window.location;
    const code = document.getElementById('code-editor').value;
    window.localStorage.setItem(window.location, JSON.stringify({codeValue: code, fileName: this.state.fileName, filePath: this.state.filePath}));
  }

  handleCodeSave(e) {
    var context = this;
    if(context.state.permissions === 'read') {
      return;
    }

    var code = document.getElementById('code-editor').value;
    const fileName = this.state.fileName;
    const containerName = this.state.containerName;
    if(!fileName.length || !this.state.filePath.length) {
      alert('Must specify a filename first!');
      return;
    }
    axios.post('/docker/handleCodeSave', {
      codeValue: code,
      fileName: fileName,
      containerName: containerName,
      filePath: this.state.filePath
    })
    .then(function(response) {
      context.setState({ codeSaved: true })
    })
    .catch(function(err) {
      console.error(err);
    });
  }

  render() {
    if (this.state.fileName) {
      return (
        <div className="code-editor-container" onKeyDown={this.handleOnKeyDown.bind(this)}>
          <div className="code-editor-menu">
              <i className="ion-ios-play-outline" onClick={this.handleFileRun}></i>
          </div>
          <textarea id="code-editor" >{this.state.codeValue}</textarea>
          <span className={this.state.codeSaved ? "code-saved-indicator" : "code-modified-indicator"}>
            {this.state.codeSaved  ? "Saved" : "Modified"}
          </span>
          <span className="current-file">
            {this.state.filePath + '/' + this.state.fileName}
          </span>
        </div>
      )
    } else {
      return (
        <div className="code-editor-container" onKeyDown={this.handleOnKeyDown.bind(this)}>
          <div className="code-editor-menu">
              <i className="ion-ios-play-outline" onClick={this.handleFileRun}></i>
          </div>
          <textarea id="code-editor" >{this.state.codeValue}</textarea>
          <span className="current-file">
             <span> No File </span>
          </span> 
        </div>
      )
    }
 
  }
}

module.exports = CodeEditor;