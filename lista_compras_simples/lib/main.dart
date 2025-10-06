import 'package:flutter/material.dart';

void main() {
  runApp(const MeuApp());
}

class MeuApp extends StatelessWidget {
  const MeuApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Lista de Compras',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: const PaginaInicial(),
    );
  }
}

class PaginaInicial extends StatefulWidget {
  const PaginaInicial({super.key});

  @override
  State<PaginaInicial> createState() => _PaginaInicialState();
}

class _PaginaInicialState extends State<PaginaInicial> {
  List<String> itensCompra = [];
  List<bool> itensComprados = []; // Lista para marcar itens comprados
  TextEditingController controladorTexto = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Minha Lista de Compras'),
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,
        actions: [
          // Botão para limpar toda a lista
          IconButton(
            icon: const Icon(Icons.clear_all),
            onPressed: limparLista,
            tooltip: 'Limpar lista',
          ),
        ],
      ),
      
      body: Column(
        children: [
          // Área para adicionar itens
          Container(
            padding: const EdgeInsets.all(16.0),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              boxShadow: [
                BoxShadow(
                  color: Colors.grey.withOpacity(0.3),
                  spreadRadius: 1,
                  blurRadius: 3,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: controladorTexto,
                    decoration: const InputDecoration(
                      hintText: 'Digite um item para comprar...',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.add_shopping_cart),
                    ),
                    onSubmitted: (texto) => adicionarItem(),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: adicionarItem,
                  icon: const Icon(Icons.add),
                  label: const Text('Adicionar'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ),
          ),
          
          // Estatísticas rápidas
          if (itensCompra.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _criarEstatistica(
                    'Total', 
                    '${itensCompra.length}', 
                    Icons.list, 
                    Colors.blue
                  ),
                  _criarEstatistica(
                    'Comprados', 
                    '${itensComprados.where((comprado) => comprado).length}', 
                    Icons.check_circle, 
                    Colors.green
                  ),
                  _criarEstatistica(
                    'Restantes', 
                    '${itensComprados.where((comprado) => !comprado).length}', 
                    Icons.pending, 
                    Colors.orange
                  ),
                ],
              ),
            ),
          
          // Lista de itens
          Expanded(
            child: itensCompra.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.shopping_cart_outlined, 
                             size: 64, color: Colors.grey[400]),
                        const SizedBox(height: 16),
                        const Text(
                          'Sua lista está vazia!',
                          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                        const Text(
                          'Adicione itens para começar suas compras',
                          style: TextStyle(fontSize: 16, color: Colors.grey),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(8),
                    itemCount: itensCompra.length,
                    itemBuilder: (context, indice) {
                      bool foiComprado = itensComprados[indice];
                      
                      return Card(
                        elevation: 2,
                        margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        child: ListTile(
                          leading: Checkbox(
                            value: foiComprado,
                            onChanged: (valor) => marcarComoComprado(indice, valor ?? false),
                          ),
                          title: Text(
                            itensCompra[indice],
                            style: TextStyle(
                              decoration: foiComprado ? TextDecoration.lineThrough : null,
                              color: foiComprado ? Colors.grey : Colors.black,
                              fontSize: 16,
                            ),
                          ),
                          trailing: IconButton(
                            icon: const Icon(Icons.delete, color: Colors.red),
                            onPressed: () => mostrarConfirmacaoRemocao(indice),
                          ),
                          tileColor: foiComprado ? Colors.green[50] : null,
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  // Widget para mostrar estatísticas
  Widget _criarEstatistica(String titulo, String valor, IconData icone, Color cor) {
    return Column(
      children: [
        Icon(icone, color: cor, size: 24),
        const SizedBox(height: 4),
        Text(
          valor,
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: cor),
        ),
        Text(titulo, style: const TextStyle(fontSize: 12, color: Colors.grey)),
      ],
    );
  }

  void adicionarItem() {
    String novoItem = controladorTexto.text.trim();
    
    if (novoItem.isNotEmpty) {
      // Verificar se item já existe
      if (itensCompra.contains(novoItem)) {
        _mostrarMensagem('Este item já está na sua lista!');
        return;
      }
      
      setState(() {
        itensCompra.add(novoItem);
        itensComprados.add(false); // Novo item começa como não comprado
        controladorTexto.clear();
      });
      
      _mostrarMensagem('Item "$novoItem" adicionado!');
    }
  }

  void removerItem(int indice) {
    String itemRemovido = itensCompra[indice];
    setState(() {
      itensCompra.removeAt(indice);
      itensComprados.removeAt(indice);
    });
    _mostrarMensagem('Item "$itemRemovido" removido!');
  }

  void marcarComoComprado(int indice, bool comprado) {
    setState(() {
      itensComprados[indice] = comprado;
    });
    
    String mensagem = comprado ? 'Item comprado!' : 'Item desmarcado!';
    _mostrarMensagem(mensagem);
  }

  void limparLista() {
    if (itensCompra.isEmpty) return;
    
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Limpar Lista'),
          content: const Text('Tem certeza que deseja remover todos os itens?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancelar'),
            ),
            TextButton(
              onPressed: () {
                setState(() {
                  itensCompra.clear();
                  itensComprados.clear();
                });
                Navigator.of(context).pop();
                _mostrarMensagem('Lista limpa!');
              },
              child: const Text('Limpar', style: TextStyle(color: Colors.red)),
            ),
          ],
        );
      },
    );
  }

  void mostrarConfirmacaoRemocao(int indice) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Remover Item'),
          content: Text('Remover "${itensCompra[indice]}" da lista?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancelar'),
            ),
            TextButton(
              onPressed: () {
                removerItem(indice);
                Navigator.of(context).pop();
              },
              child: const Text('Remover', style: TextStyle(color: Colors.red)),
            ),
          ],
        );
      },
    );
  }

  void _mostrarMensagem(String mensagem) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(mensagem),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  void dispose() {
    controladorTexto.dispose();
    super.dispose();
  }
}
