#include <bits/stdc++.h>
using namespace std;

int main(){
    cin.tie(0);
    ios_base::sync_with_stdio(0);
    //start here
    // STL (from https://www.geeksforgeeks.org/cpp/list-cpp-stl/)
    list<int> myList;
    myList.push_back(10);
    myList.push_back(20);
    myList.push_front(5);

    cout << "List elements: ";
    for (int n : myList){
        cout << n << " ";
    }
    cout << endl;
    // structure
    struct Node{
        int data;
        Node* next;
        Node(int x){
            this->data = x;
            this->next = nullptr;
        }
    };

    Node* head = new Node(0);
    Node* cur = head;
    for(int i = 1;i <= 10;i++){
        cur->next = new Node(i);
        cur = cur->next;
    }

    // print it
    cur = head;
    while(cur != nullptr){
        cout << cur->data << " ";
        cur = cur->next;
    }

    struct Trie{
        int data;
        vector<Trie *> next;
        Trie(int x){
            this->data = x;
            next = vector<Trie *>(3,nullptr);
        }
    };
    Trie *thead = new Trie(1);
    thead->next[0] = new Trie(1);
    thead->next[1] = new Trie(2);
    thead->next[2] = new Trie(3);
    thead->next[0]->next[0] = new Trie(4);

}