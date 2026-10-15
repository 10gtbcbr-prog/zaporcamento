package com.belmontapps.zaporcamento;
import android.app.Activity;
import android.content.*;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.*;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.FileProvider;
import androidx.core.view.*;
import androidx.webkit.WebViewAssetLoader;
import org.json.JSONObject;
import java.io.*;
public class MainActivity extends ComponentActivity {
 private WebView web; private File pending; private String pendingId; private ValueCallback<Uri[]> fileCallback;
 private final ActivityResultLauncher<Intent> chooseExport=registerForActivityResult(new ActivityResultContracts.StartActivityForResult(),result->{
  File source=pending;String id=pendingId;pending=null;pendingId=null;if(id==null)return;
  if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null||result.getData().getData()==null){if(source!=null)source.delete();reply(id,false,"Salvamento cancelado.");return;}
  Uri uri=result.getData().getData();new Thread(()->{try{
   if(source==null||source.length()==0)throw new IOException("Arquivo de origem vazio");long expected=source.length();
   try(InputStream in=new FileInputStream(source);OutputStream out=getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new IOException("Destino indisponível");byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1)out.write(buf,0,n);out.flush();}
   long actual=0;try(InputStream in=getContentResolver().openInputStream(uri)){if(in==null)throw new IOException("Não foi possível conferir");byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1)actual+=n;}
   if(actual!=expected)throw new IOException("Gravação incompleta");reply(id,true,"Arquivo gravado e conferido.");
  }catch(Exception e){reply(id,false,"Não foi possível gravar: "+e.getMessage());}finally{if(source!=null)source.delete();}}).start();
 });
 private final ActivityResultLauncher<Intent> chooseFile=registerForActivityResult(new ActivityResultContracts.StartActivityForResult(),result->{if(fileCallback!=null){fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.getResultCode(),result.getData()));fileCallback=null;}});
 @Override public void onCreate(Bundle state){super.onCreate(state);
  if(state!=null){pendingId=state.getString("pendingId");String path=state.getString("pendingPath");if(path!=null)pending=new File(path);}
  android.widget.FrameLayout root=new android.widget.FrameLayout(this);root.setBackgroundColor(0xfff1f5f9);
  web=new WebView(this);web.setBackgroundColor(0xfff1f5f9);root.addView(web,new android.widget.FrameLayout.LayoutParams(-1,-1));setContentView(root);WindowCompat.setDecorFitsSystemWindows(getWindow(),false);
  ViewCompat.setOnApplyWindowInsetsListener(root,(v,insets)->{
   androidx.core.graphics.Insets bars=insets.getInsets(WindowInsetsCompat.Type.systemBars());
   androidx.core.graphics.Insets ime=insets.getInsets(WindowInsetsCompat.Type.ime());
   v.setPadding(bars.left,bars.top,bars.right,Math.max(bars.bottom,ime.bottom));
   boolean visible=insets.isVisible(WindowInsetsCompat.Type.ime());
   web.post(()->web.evaluateJavascript("window.ajustarTeclado && window.ajustarTeclado("+visible+")",null));
   return WindowInsetsCompat.CONSUMED;
  });ViewCompat.requestApplyInsets(root);
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  WebViewAssetLoader assets=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
  web.setWebViewClient(new WebViewClient(){@Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){return assets.shouldInterceptRequest(r.getUrl());}@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){Uri u=r.getUrl();if("appassets.androidplatform.net".equals(u.getHost()))return false;if("https".equals(u.getScheme())&&"wa.me".equals(u.getHost()))openWhatsAppExternal(u.toString());return true;}});
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onJsAlert(WebView v,String url,String message,JsResult result){new android.app.AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("OK",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
   @Override public boolean onJsConfirm(WebView v,String url,String message,JsResult result){new android.app.AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("Confirmar",(d,w)->result.confirm()).setNegativeButton("Cancelar",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
@Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams params){if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=cb;try{chooseFile.launch(params.createIntent());}catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;}return true;}});
  web.addJavascriptInterface(new FileBridge(),"Android");web.loadUrl("https://appassets.androidplatform.net/assets/www/index.html");
  getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){@Override public void handleOnBackPressed(){web.evaluateJavascript("window.voltarAndroid ? window.voltarAndroid() : false",handled->{if(!"true".equals(handled))moveTaskToBack(true);});}});
 }
 @Override protected void onSaveInstanceState(Bundle out){super.onSaveInstanceState(out);out.putString("pendingId",pendingId);if(pending!=null)out.putString("pendingPath",pending.getAbsolutePath());}
 private void reply(String id,boolean ok,String msg){runOnUiThread(()->web.evaluateJavascript("window.nativeResult && window.nativeResult("+JSONObject.quote(id)+","+ok+","+JSONObject.quote(msg)+")",null));}
 private void openWhatsAppExternal(String url){try{Uri u=Uri.parse(url);if(!"https".equals(u.getScheme())||!"wa.me".equals(u.getHost()))return;startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception e){android.widget.Toast.makeText(this,"Não foi possível abrir o WhatsApp. Confira a instalação e a conexão.",android.widget.Toast.LENGTH_LONG).show();}}
 public class FileBridge {
  @JavascriptInterface public void openWhatsApp(String url){runOnUiThread(()->openWhatsAppExternal(url));}
  @JavascriptInterface public void exportFile(String raw){String id="";try{JSONObject o=new JSONObject(raw);id=o.getString("id");String name=new File(o.getString("name")).getName();String mime=o.getString("mime");if(!mime.equals("application/pdf")&&!mime.equals("application/json"))throw new IOException("Tipo inválido");byte[] data=Base64.decode(o.getString("data"),Base64.DEFAULT);if(data.length==0||data.length>30000000)throw new IOException("Tamanho inválido");File folder=new File(getCacheDir(),"exports");if(!folder.exists()&&!folder.mkdirs())throw new IOException("Não foi possível preparar o arquivo");File[] old=folder.listFiles();if(old!=null)for(File f:old)if(System.currentTimeMillis()-f.lastModified()>86400000L)f.delete();File file=new File(folder,name);try(FileOutputStream out=new FileOutputStream(file)){out.write(data);out.getFD().sync();}
   final String rid=id;final String action=o.getString("action");runOnUiThread(()->{try{if(action.equals("share")){Uri uri=FileProvider.getUriForFile(MainActivity.this,getPackageName()+".files",file);Intent send=new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);send.setClipData(ClipData.newRawUri("arquivo",uri));startActivity(Intent.createChooser(send,"Compartilhar PDF"));reply(rid,true,"Arquivo preparado.");}else{if(pendingId!=null)throw new IOException("Conclua o salvamento anterior");pending=file;pendingId=rid;chooseExport.launch(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE,name));}}catch(Exception e){pendingId=null;pending=null;reply(rid,false,e.getMessage());}});
  }catch(Exception e){reply(id,false,e.getMessage());}}
 }
}
